import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  if (!process.env.FIREBASE_PRIVATE_KEY) {

    console.warn("FIREBASE_PRIVATE_KEY is missing, initializing with dummy projectId to allow build to proceed.");
    return initializeApp({ projectId: "demo-project" });
  }

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,

      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const adminApp = getAdminApp();

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
