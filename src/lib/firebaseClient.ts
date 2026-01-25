// src/lib/firebaseAdmin.ts
import * as admin from "firebase-admin";

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountJson) {
  throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY");
}

// JSON.parseで型を ServiceAccount に寄せる
const serviceAccount = JSON.parse(serviceAccountJson) as admin.ServiceAccount;

export function getAdminApp() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  return admin.app();
}

export function getAdminDb() {
  getAdminApp();
  return admin.firestore();
}

export function getAdminAuth() {
  getAdminApp();
  return admin.auth();
}