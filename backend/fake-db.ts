// In-memory stand-in for the Firestore calls the API makes. Used by the tests and by the
// demo server (npm run demo), which runs the real API on a site from data/sites/ without Firebase.
import { loadSite, makeUndirected, waypointDoc, waypointDocId } from './scripts/site-data';

type Doc = Record<string, any>;

export class FakeDb {
  data = new Map<string, Map<string, Doc>>();
  col(name: string) {
    if (!this.data.has(name)) this.data.set(name, new Map());
    return this.data.get(name)!;
  }
  collection(name: string) {
    const col = this.col(name);
    const snap = (id: string, d: Doc | undefined) => ({ id, exists: d !== undefined, data: () => d });
    const query = (pred: (d: Doc) => boolean) => {
      const docs = [...col.entries()].filter(([, d]) => pred(d)).map(([id, d]) => snap(id, d));
      return { empty: docs.length === 0, size: docs.length, docs, forEach: (fn: (d: any) => void) => docs.forEach(fn) };
    };
    return {
      doc: (id: string) => ({
        get: async () => snap(id, col.get(id)),
        set: async (value: Doc) => { col.set(id, value); },
      }),
      where: (field: string, _op: string, value: unknown) => ({ get: async () => query(d => d[field] === value) }),
      get: async () => query(() => true),
    };
  }
}

/** Load data/sites/<siteId> into the fake db, exactly as `npm run import-site` would. */
export function seedSite(db: FakeDb, siteId: string, siteOverrides: Record<string, unknown> = {}) {
  const { config, waypoints, errors } = loadSite(siteId);
  if (errors.length) throw new Error(`Site ${siteId} is invalid: ${errors.join('; ')}`);
  makeUndirected(waypoints);
  for (const w of waypoints) db.col('ar_waypoints').set(waypointDocId(siteId, w.node_id), waypointDoc(siteId, w));
  db.col('sites').set(siteId, {
    name: config.name,
    north_offset_deg: config.north_offset_deg,
    magnetic_declination_deg: config.magnetic_declination_deg,
    ...siteOverrides,
  });
}
