import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebaseClient";

export const runtime = "nodejs";

function fromBase64url(s: string) {
  const pad = 4 - (s.length % 4 || 4);
  const padded = s + "=".repeat(pad === 4 ? 0 : pad);
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

function verifyEmailChangeToken(token: string): { uid: string; newEmail: string } {
  const secret = process.env.READ_TOKEN_SECRET;
  if (!secret) throw new Error("READ_TOKEN_SECRET is not set");

  const [body, sig] = token.split(".");
  if (!body || !sig) throw new Error("Invalid token format");

  const expected = crypto.createHmac("sha256", secret).update(body).digest();
  const given = fromBase64url(sig);

  if (given.length !== expected.length) throw new Error("Invalid signature");
  if (!crypto.timingSafeEqual(given, expected)) throw new Error("Invalid signature");

  const payload = JSON.parse(fromBase64url(body).toString("utf-8"));

  if (payload.purpose !== "email_change") throw new Error("Invalid token purpose");
  if (!payload.exp || Math.floor(Date.now() / 1000) > payload.exp) throw new Error("Token expired");
  if (!payload.uid || !payload.newEmail) throw new Error("Invalid payload");

  return { uid: payload.uid, newEmail: payload.newEmail };
}

export async function GET(req: Request) {
  const baseUrl = process.env.APP_BASE_URL || "https://www.tapsmart.jp";

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return NextResponse.redirect(`${baseUrl}/account?email-change=error`);
    }

    const { uid, newEmail } = verifyEmailChangeToken(token);

    const adminAuth = getAdminAuth();

    // メールが既に他のユーザーに使われていないか再チェック
    try {
      const existing = await adminAuth.getUserByEmail(newEmail);
      if (existing.uid !== uid) {
        return NextResponse.redirect(`${baseUrl}/account?email-change=in-use`);
      }
    } catch (e: any) {
      if (e?.code !== "auth/user-not-found") {
        throw e;
      }
    }

    // Firebase Auth のメールアドレスを更新
    await adminAuth.updateUser(uid, { email: newEmail, emailVerified: true });

    // Firestore の users ドキュメントも更新
    const db = getAdminDb();
    await db.collection("users").doc(uid).set(
      { email: newEmail, updatedAt: new Date() },
      { merge: true }
    );

    return NextResponse.redirect(`${baseUrl}/account?email-change=success`);
  } catch (e: any) {
    console.error("[apply-email-change] error:", e?.message);
    const reason = e?.message?.includes("expired") ? "expired" : "error";
    return NextResponse.redirect(`${baseUrl}/account?email-change=${reason}`);
  }
}
