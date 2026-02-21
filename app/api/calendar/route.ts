import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebaseClient";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const db = getAdminDb();

    // 1回のクエリで全 studyLogs を取得（dateKey のみ select）
    const snap = await db
      .collection("studyLogs")
      .where("uid", "==", uid)
      .select("dateKey")
      .orderBy("dateKey", "desc")
      .limit(5000)
      .get();

    const dateKeys: string[] = [];
    for (const d of snap.docs) {
      const k = (d.data() as any)?.dateKey;
      if (typeof k === "string") dateKeys.push(k);
    }

    // ユニーク化
    const unique = Array.from(new Set(dateKeys));

    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.exists ? (userSnap.data() as any) : null;

    const deliveryDays: number[] = Array.isArray(userData?.deliveryDays) ? userData.deliveryDays : [0,1,2,3,4,5,6];

    // 曜日ごとの配信停止開始日
    const deliveryDayOffSince = (userData?.deliveryDayOffSince ?? {}) as Record<string, string>;

    // 配信曜日OFFでスキップされた日を取得
    const skippedSnap = await db
      .collection("deliveries")
      .where("uid", "==", uid)
      .where("status", "==", "skipped_day_off")
      .select("dateKey")
      .get();
    const skippedDayOffKeys: string[] = [];
    for (const d of skippedSnap.docs) {
      const k = (d.data() as any)?.dateKey;
      if (typeof k === "string") skippedDayOffKeys.push(k);
    }

    return NextResponse.json({
      ok: true,
      count: unique.length,
      dateKeys: unique,
      deliveryDays,
      deliveryDayOffSince,
      skippedDayOffKeys,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
