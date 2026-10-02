// Validate a surveyed site and upload it to Firestore.
//
//   npm run import-site -- <siteId> [--dry-run] [--prune] [--directed]
//
// Reads data/sites/<siteId>/site.json and waypoints.csv (format: data/README.md).
// Writes sites/<siteId> and one ar_waypoints doc per node (doc ID "<siteId>__<node_id>").
//   --dry-run   validate and report only; no Firebase needed
//   --prune     delete ar_waypoints docs for this site that are no longer in the CSV
//   --directed  keep neighbour lists as written (default: every edge is made two-way)
import { initFirebase } from '../firebase';
import { loadSite, makeUndirected, unreachableFrom, waypointDoc, waypointDocId } from './site-data';

const args = process.argv.slice(2);
const siteId = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const prune = args.includes('--prune');
const directed = args.includes('--directed');

if (!siteId) {
  console.error('Usage: npm run import-site -- <siteId> [--dry-run] [--prune] [--directed]');
  process.exit(1);
}

const { config, waypoints, errors } = loadSite(siteId);
if (errors.length) {
  console.error(`${errors.length} problem(s) in data/sites/${siteId}:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

if (!directed) makeUndirected(waypoints);

const anchors = waypoints.filter(w => w.type === 'anchor');
const destinations = waypoints.filter(w => w.name && !w.name.includes('Node'));
// Every node should be reachable from the first one, or some routes will silently fail.
const cut = unreachableFrom(waypoints);
console.log(`Site ${siteId} (${config.name}): ${waypoints.length} nodes, ${anchors.length} anchors, ${destinations.length} destinations`);
if (cut.length) console.warn(`Warning: not reachable from ${waypoints[0].node_id}: ${cut.join(', ')}`);
if (config.north_offset_deg === null) console.warn('Warning: site.json north_offset_deg is not set — run scripts/groundtruth.py first.');

async function main() {
  if (dryRun) {
    console.log('Dry run: nothing written.');
    return;
  }
  const db = initFirebase();
  if (!db) process.exit(1);

  await db.collection('sites').doc(siteId!).set({
    name: config.name,
    north_offset_deg: config.north_offset_deg,
    magnetic_declination_deg: config.magnetic_declination_deg,
  });

  const keep = new Set<string>();
  for (let i = 0; i < waypoints.length; i += 400) {
    const batch = db.batch();
    for (const w of waypoints.slice(i, i + 400)) {
      const id = waypointDocId(siteId!, w.node_id);
      keep.add(id);
      batch.set(db.collection('ar_waypoints').doc(id), waypointDoc(siteId!, w));
    }
    await batch.commit();
  }
  console.log(`Wrote sites/${siteId} and ${waypoints.length} ar_waypoints docs.`);

  const existing = await db.collection('ar_waypoints').where('station_id', '==', siteId).get();
  const stale = existing.docs.filter(d => !keep.has(d.id));
  if (stale.length && prune) {
    const batch = db.batch();
    stale.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`Pruned ${stale.length} stale docs.`);
  } else if (stale.length) {
    console.warn(`${stale.length} docs for this site are not in the CSV (${stale.map(d => d.id).join(', ')}). Re-run with --prune to delete them.`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
