import admin from "firebase-admin";
import { readFileSync } from "fs";
import { join } from "path";

if (!admin.apps.length) {
  try {
    let serviceAccount: object;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Production (Vercel): credentials stored as JSON env var
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      // Local dev: read serviceAccount.json from project root
      const serviceAccountPath = join(process.cwd(), "serviceAccount.json");
      serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
    console.log("[Firebase Admin] Initialized successfully");
  } catch (error) {
    console.error("[Firebase Admin] Failed to initialize:", error);
  }
}

export const adminDb = admin.apps.length ? admin.firestore() : null;
export const adminAuth = admin.apps.length ? admin.auth() : null;
