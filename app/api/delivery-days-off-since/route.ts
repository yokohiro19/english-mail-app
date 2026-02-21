import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebaseClient";
import { FieldValue } from "firebase-admin/firestore";

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
    if (!token) return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const body = await req.json().catch(() => ({}));
    const changes = body.changes as Record<string, string> | undefined;
    if (!changes || typeof changes !== "object") {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }

    const db = getAdminDb();
    const userRef = db.collection("users").doc(uid);
    const todayKey = dateKeyFromJst(logicalJstNow());

    const updateData: Record<string, any> = {};
    for (const [dow, action] of Object.entries(changes)) {
      if (action === "set") {
        updateData[`deliveryDayOffSince.${dow}`] = todayKey;
      } else if (action === "remove") {
        updateData[`deliveryDayOffSince.${dow}`] = FieldValue.delete();
      }
    }

    if (Object.keys(updateData).length > 0) {
      await userRef.update(updateData);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[delivery-days-off-since]", e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
