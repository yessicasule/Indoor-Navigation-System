import 'dotenv/config'; // load backend/.env for the server and the data scripts alike
import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

/**
 * Initialise Firebase Admin, trying in order:
 *   1. backend/serviceAccountKey.json (local development; ignored if empty)
 *   2. FIREBASE_SERVICE_ACCOUNT — the key file's JSON as an env var (hosted deployments)
 *   3. GOOGLE_APPLICATION_CREDENTIALS — path to a key file, or ambient Google Cloud credentials
 * Returns null (with a warning) if none works.
 */
export function initFirebase(): admin.firestore.Firestore | null {
  if (admin.apps.length) return admin.firestore();
  try {
    const saPath = path.join(__dirname, 'serviceAccountKey.json');
    if (fs.existsSync(saPath) && fs.statSync(saPath).size > 0) {
      const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount as admin.ServiceAccount) });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount as admin.ServiceAccount) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp();
    } else {
      console.warn('Warning: no Firebase credentials (serviceAccountKey.json, FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS).');
      return null;
    }
    return admin.firestore();
  } catch (err) {
    console.warn(`Warning: Firebase Admin not initialized (${(err as Error).message}). Check serviceAccountKey.json.`);
    return null;
  }
}
