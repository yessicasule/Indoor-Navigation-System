import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

/**
 * Initialise Firebase Admin from backend/serviceAccountKey.json, or from
 * GOOGLE_APPLICATION_CREDENTIALS. Returns null (with a warning) if neither works.
 */
export function initFirebase(): admin.firestore.Firestore | null {
  if (admin.apps.length) return admin.firestore();
  try {
    const saPath = path.join(__dirname, 'serviceAccountKey.json');
    if (fs.existsSync(saPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount as admin.ServiceAccount) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp();
    } else {
      console.warn('Warning: No serviceAccountKey.json and GOOGLE_APPLICATION_CREDENTIALS not set.');
      return null;
    }
    return admin.firestore();
  } catch (err) {
    console.warn(`Warning: Firebase Admin not initialized (${(err as Error).message}). Check serviceAccountKey.json.`);
    return null;
  }
}
