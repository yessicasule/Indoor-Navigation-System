// Run the real API and the built frontend against an in-memory copy of one site — no Firebase.
//
//   npm run demo -- [siteId]        (default: _template; build the frontend first)
//
// Telemetry posts are accepted and kept in memory only, so nothing is recorded.
import path from 'path';
import { createApp } from '../app';
import { FakeDb, seedSite } from '../fake-db';

const siteId = process.argv[2] ?? '_template';
const port = Number(process.env.PORT) || 3001;
const db = new FakeDb();
seedSite(db, siteId);

createApp({
  db,
  storageAvailable: true,
  serverTimestamp: () => new Date().toISOString(),
  frontendDist: path.resolve(__dirname, '../../Indoor-Navigation-System/dist'),
}).listen(port, () => {
  const anchors = [...db.col('ar_waypoints').entries()].filter(([, d]) => d.type === 'anchor').map(([id]) => id);
  console.log(`Demo server (site ${siteId}, in-memory data) on http://localhost:${port}`);
  for (const id of anchors) console.log(`  anchor: http://localhost:${port}/ar?site=${siteId}&node=${id}`);
});
