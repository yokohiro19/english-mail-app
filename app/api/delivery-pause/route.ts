import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebaseClient";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

// JST helpers
// 4:00 AM JST boundary: JST - 4h = UTC + 5h
function logicalJstNow() {
  return new Date(Date.now() + 5 * 60 * 60 * 1000);
}
function dateKeyFromJst(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const body = await req.json().catch(() => ({}));
    const paused = body.paused === true;

    const db = getAdminDb();
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
    }

    const userData = userSnap.data() as any;
    const wasPaused = Boolean(userData.deliveryPaused);
    const todayKey = dateKeyFromJst(logicalJstNow());

    if (paused && !wasPaused) {
      // Start pause: record pausedAt
      await userRef.set(
        {
          deliveryPaused: true,
          pausedAt: todayKey,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else if (!paused && wasPaused) {
      // Resume: record the paused period (dedup)
      const pausedAt = userData.pausedAt as string | null;
      const pausedPeriods = (userData.pausedPeriods ?? []) as Array<{ start: string; end: string }>;

      if (pausedAt) {
        const alreadyExists = pausedPeriods.some(
          (p) => p.start === pausedAt && p.end === todayKey
        );
        if (!alreadyExists) {
          pausedPeriods.push({ start: pausedAt, end: todayKey });
        }
      }

      await userRef.set(
        {
          deliveryPaused: false,
          pausedAt: FieldValue.delete(),
          pausedPeriods,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    return NextResponse.json({ ok: true, paused });
  } catch (e: any) {
    console.error("[delivery-pause]", e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
