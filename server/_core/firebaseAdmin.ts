import admin from "firebase-admin";
import { readFileSync } from "fs";
import { join } from "path";
import { ENV } from "./env";

if (!admin.apps.length) {
  try {
    const serviceAccountPath = join(process.cwd(), "serviceAccount.json");
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: ENV.firebaseStorageBucket || undefined,
    });
    console.log("[Firebase Admin] Initialized successfully");
  } catch (error) {
    console.error("[Firebase Admin] Failed to initialize:", error);
  }
}

export const adminDb = admin.apps.length ? admin.firestore() : null;
export const adminAuth = admin.apps.length ? admin.auth() : null;
export const adminStorage = admin.apps.length ? admin.storage() : null;
export const adminBucket =
  admin.apps.length && ENV.firebaseStorageBucket
    ? admin.storage().bucket(ENV.firebaseStorageBucket)
    : null;
