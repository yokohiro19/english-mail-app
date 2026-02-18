import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebaseAdmin.server";

function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });

    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid = decoded.uid;
    const email = (decoded as any)?.email ?? null;

    if (!email) return NextResponse.json({ ok: true, trialUsed: false });

    const db = getAdminDb();
    const hash = hashEmail(email);
    const snap = await db.collection("trialEmails").doc(hash).get();

    if (snap.exists) {
      await db.collection("users").doc(uid).set({ trialUsed: true, updatedAt: new Date() }, { merge: true });
      return NextResponse.json({ ok: true, trialUsed: true });
    }

    return NextResponse.json({ ok: true, trialUsed: false });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
