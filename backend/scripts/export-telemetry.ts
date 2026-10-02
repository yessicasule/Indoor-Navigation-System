// Export study telemetry from Firestore to one CSV row per sample.
//
//   npm run export -- [--site <siteId>] [--out <path>]
//
// Default output: data/export/telemetry.csv (the input to scripts/analyse.py).
import fs from 'fs';
import path from 'path';
import { initFirebase } from '../firebase';
import { DATA_DIR, toCsv } from './site-data';

const SESSION_COLUMNS = ['session_id', 'participant_id', 'condition', 'site_id', 'device_model', 'os_version', 'user_agent'];
const SAMPLE_COLUMNS = [
  'timestamp_ms', 'event_type', 'absolute_flag', 'sample_age_ms',
  'raw_alpha', 'raw_beta', 'raw_gamma', 'webkit_compass_heading', 'heading_source', 'raw_heading', 'smoothed_heading',
  'heading_correction', 'corrected_heading', 'frame_offset_deg', 'calibration_source',
  'last_anchor_id', 'ms_since_anchor', 'metres_since_anchor',
  'nodes_traversed', 'current_node', 'current_target_node', 'survey_point_id',
];

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const site = opt('--site');
const out = path.resolve(opt('--out') ?? path.join(DATA_DIR, 'export', 'telemetry.csv'));

async function main() {
  const db = initFirebase();
  if (!db) process.exit(1);

  let query: FirebaseFirestore.Query = db.collection('telemetry_batches');
  if (site) query = query.where('site_id', '==', site);
  const snapshot = await query.get();

  const rows: Record<string, unknown>[] = [];
  snapshot.forEach(doc => {
    const batch = doc.data();
    for (const sample of batch.samples ?? []) {
      rows.push({ batch_id: doc.id, ...Object.fromEntries(SESSION_COLUMNS.map(c => [c, batch[c]])), ...sample });
    }
  });
  rows.sort((a, b) =>
    String(a.session_id).localeCompare(String(b.session_id)) || Number(a.timestamp_ms) - Number(b.timestamp_ms));

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, toCsv(rows, [...SESSION_COLUMNS, ...SAMPLE_COLUMNS, 'batch_id']));
  const sessions = new Set(rows.map(r => r.session_id)).size;
  console.log(`Exported ${rows.length} samples from ${snapshot.size} batches (${sessions} sessions) to ${out}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
