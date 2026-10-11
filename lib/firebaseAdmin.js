
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId) {
  throw new Error(
    "FIREBASE_PROJECT_ID is missing from .env.local"
  );
}

if (!clientEmail) {
  throw new Error(
    "FIREBASE_CLIENT_EMAIL is missing from .env.local"
  );
}

if (!privateKey) {
  throw new Error(
    "FIREBASE_PRIVATE_KEY is missing from .env.local"
  );
}

const firebaseAdminApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          project_id: projectId,
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, "\n"),
        }),
      });

export const adminAuth = getAuth(firebaseAdminApp);
export const adminDb = getFirestore(firebaseAdminApp);

export default firebaseAdminApp;
