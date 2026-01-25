import "server-only";
import * as admin from "firebase-admin";

function parseServiceAccount(raw: string): admin.ServiceAccount {
  // JSON直貼り → まずこれ
  try {
    const obj = JSON.parse(raw);
    if (typeof (obj as any).private_key === "string") {
      (obj as any).private_key = (obj as any).private_key.replace(/\\n/g, "\n");
    }
    return obj as admin.ServiceAccount;
  } catch {
    // base64 → これ
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    const obj = JSON.parse(decoded);
    if (typeof (obj as any).private_key === "string") {
      (obj as any).private_key = (obj as any).private_key.replace(/\\n/g, "\n");
    }
    return obj as admin.ServiceAccount;
  }
}

function initAdmin() {
  if (admin.apps.length) return admin.app();

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY");

  const serviceAccount = parseServiceAccount(raw);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return admin.app();
}

export function getAdminApp() {
  return initAdmin();
}

export function getAdminDb() {
  initAdmin();
  return admin.firestore();
}

export function getAdminAuth() {
  initAdmin();
  return admin.auth();
}