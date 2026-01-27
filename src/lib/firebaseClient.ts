// src/lib/firebaseAdmin.ts
import "server-only";
import * as admin from "firebase-admin";

/**
 * FIREBASE_SERVICE_ACCOUNT_KEY は以下どちらでもOK
 * - service account JSON をそのまま文字列で貼る
 * - service account JSON を base64 化した文字列
 */
function loadServiceAccount(): admin.ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY");
  }

  // 1) まず JSON としてパースを試す
  try {
    const parsed = JSON.parse(raw);
    return normalizeServiceAccount(parsed);
  } catch {
    // 2) ダメなら base64 としてデコードして再パース
    try {
      const decoded = Buffer.from(raw, "base64").toString("utf8");
      const parsed = JSON.parse(decoded);
      return normalizeServiceAccount(parsed);
    } catch {
      throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_KEY format");
    }
  }
}

/**
 * private_key の改行問題を確実に修正
 */
function normalizeServiceAccount(obj: any): admin.ServiceAccount {
  if (typeof obj.private_key === "string") {
    obj.private_key = obj.private_key.replace(/\\n/g, "\n");
  }
  return obj as admin.ServiceAccount;
}

function initAdminApp() {
  if (admin.apps.length) {
    return admin.app();
  }

  const serviceAccount = loadServiceAccount();

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return admin.app();
}

export function getAdminApp() {
  return initAdminApp();
}

export function getAdminDb() {
  initAdminApp();
  return admin.firestore();
}

export function getAdminAuth() {
  initAdminApp();
  return admin.auth();
}