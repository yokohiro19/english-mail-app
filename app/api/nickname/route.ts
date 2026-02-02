import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebaseClient";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token)
      return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const body = await req.json().catch(() => ({}));
    const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";

    const db = getAdminDb();
    await db.collection("users").doc(uid).set(
      { nickname, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[nickname]", e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
