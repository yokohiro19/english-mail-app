import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebaseClient";
import type { Query, QueryDocumentSnapshot } from "firebase-admin/firestore";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const db = getAdminDb();

    // 上限（十分大きく。1日1件でも10年以上OK）
    const MAX = 5000;
    const dateKeys: string[] = [];

    // ※ここが重要：select("dateKey") を外して確実に取る
    const baseQuery: Query = db
      .collection("studyLogs")
      .where("uid", "==", uid)
      .orderBy("dateKey", "desc");

    let lastDoc: QueryDocumentSnapshot | null = null;

    while (dateKeys.length < MAX) {
      let q: Query = baseQuery;

      if (lastDoc) q = q.startAfter(lastDoc);
      q = q.limit(500);

      const snap = await q.get();
      if (snap.empty) break;

      for (const d of snap.docs) {
        const data = d.data() as any;

        // dateKey が文字列として入っている前提
        const k = data?.dateKey;
        if (typeof k === "string") dateKeys.push(k);
      }

      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < 500) break;
    }

    // ユニーク化
    const unique = Array.from(new Set(dateKeys));

    return NextResponse.json({
      ok: true,
      count: unique.length,
      dateKeys: unique,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown_error" }, { status: 400 });
  }
}