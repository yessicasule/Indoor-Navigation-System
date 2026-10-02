import * as dotenv from 'dotenv';
import path from 'path';
import { initFirebase } from './firebase';
import { createApp } from './app';

dotenv.config();

// If Firebase can't be initialised, fall back to a harmless stub `db` so the server
// still starts for development (reads return empty, telemetry writes return 503).
const firestore = initFirebase();
const db = firestore ?? {
  collection: () => ({
    get: async () => ({ empty: true, docs: [], forEach: () => {} }),
    doc: () => ({ get: async () => ({ exists: false }) }),
    where: () => ({ get: async () => ({ empty: true, forEach: () => {} }) }),
  }),
};
if (!firestore) console.warn('Running with an empty stub database.');

const port = Number(process.env.PORT) || 3001;
const app = createApp({
  db,
  storageAvailable: firestore !== null,
  frontendDist: path.resolve(__dirname, '../Indoor-Navigation-System/dist'),
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
