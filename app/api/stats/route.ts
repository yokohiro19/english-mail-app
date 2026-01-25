import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebaseClient";
import type { Query } from "firebase-admin/firestore";

type Rank = "S" | "A" | "B" | "C";
type RateBlock = { hit: number; days: number; rate: number; rank: Rank };

function rankOf(rate: number): Rank {
  if (rate >= 0.95) return "S";
  if (rate >= 0.8) return "A";
  if (rate >= 0.5) return "B";
  return "C";
}

// ---- JST helpers (YYYY-MM-DD 生成をズラさない) ----
function jstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}
function dateKeyFromJst(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function jstMidnightUtcDate(y: number, m1to12: number, d1to31: number) {
  // JSTの 00:00 を、UTCとして表現する（内部計算用）
  // ここでは「JST日時」をUTCフィールドに入れる運用（dateKeyFromJstと整合）
  return new Date(Date.UTC(y, m1to12 - 1, d1to31, 0, 0, 0));
}
function addDaysUtc(d: Date, n: number) {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}
function addMonthsJstMidnight(baseJstMidnightUtc: Date, n: number) {
  // baseは「JSTの00:00」をUTCフィールドに入れたDate
  const y = baseJstMidnightUtc.getUTCFullYear();
  const m = baseJstMidnightUtc.getUTCMonth(); // 0-11
  return new Date(Date.UTC(y, m + n, 1, 0, 0, 0));
}
function daysInMonthJst(y: number, m1to12: number) {
  // JSTのカレンダー上の月日数
  return new Date(Date.UTC(y, m1to12, 0, 0, 0, 0)).getUTCDate();
}

async function countDocs(query: Query) {
  // Firestore aggregate count が使えれば使う（高速）
  // 使えない環境でも get().size で動く（遅い可能性はあるが日次ログなら現実的）
  // @ts-ignore
  if (typeof (query as any).count === "function") {
    // @ts-ignore
    const agg = await (query as any).count().get();
    // @ts-ignore
    return Number(agg.data().count ?? 0);
  }
  const snap = await query.get();
  return snap.size;
}

async function hitCountByDateKeyRange(params: {
  db: ReturnType<typeof getAdminDb>;
  uid: string;
  startKey: string; // inclusive
  endKey: string; // inclusive
}) {
  const { db, uid, startKey, endKey } = params;

  // uid== AND dateKey range
  // Firestore的には orderBy(dateKey) が必要
  const q = db
    .collection("studyLogs")
    .where("uid", "==", uid)
    .where("dateKey", ">=", startKey)
    .where("dateKey", "<=", endKey)
    .orderBy("dateKey", "desc");

  const snap = await q.get();
  const s = new Set<string>();
  for (const d of snap.docs) {
    const k = (d.data() as any)?.dateKey;
    if (typeof k === "string") s.add(k);
  }
  return s.size;
}

function rateBlock(hit: number, days: number): RateBlock {
  const safeDays = Math.max(1, days);
  const rate = Math.min(1, hit / safeDays);
  return { hit, days, rate, rank: rankOf(rate) };
}

function isIndexError(e: any) {
  const msg = String(e?.message ?? "");
  // Firestoreの複合インデックス不足でよく出る文言を広めに吸収
  return (
    msg.includes("requires an index") ||
    msg.includes("FAILED_PRECONDITION") ||
    msg.includes("The query requires an index")
  );
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const db = getAdminDb();

    // ---- 今日(JST) ----
    const nowJst = jstNow();
    const todayKey = dateKeyFromJst(nowJst);

    // 返却する値（失敗しても ok:true を維持してUIを落とさない）
    let thisWeek: RateBlock = rateBlock(0, 1);
    let thisMonth: RateBlock = rateBlock(0, 1);
    let monthlySummary: Array<{
      ym: string;
      startKey: string;
      endKey: string;
      hit: number;
      days: number;
      rate: number;
      rank: Rank;
    }> = [];
    let totalStudyLogs = 0;
    let items: any[] = [];
    const partialErrors: string[] = [];

    // ---- 今週（月曜始まり） ----
    try {
      const dow = nowJst.getUTCDay(); // 0=Sun..6=Sat
      const offsetFromMonday = (dow + 6) % 7; // Mon=0, Tue=1, ... Sun=6
      const mondayJst = addDaysUtc(
        jstMidnightUtcDate(nowJst.getUTCFullYear(), nowJst.getUTCMonth() + 1, nowJst.getUTCDate()),
        -offsetFromMonday
      );
      const weekStartKey = dateKeyFromJst(mondayJst);
      const weekEndKey = todayKey; // 今日まで
      const weekDays = offsetFromMonday + 1;

      const weekHit = await hitCountByDateKeyRange({
        db,
        uid,
        startKey: weekStartKey,
        endKey: weekEndKey,
      });
      thisWeek = rateBlock(weekHit, weekDays);
    } catch (e: any) {
      console.error("[stats] thisWeek failed:", e);
      partialErrors.push(isIndexError(e) ? "thisWeek_requires_index" : "thisWeek_failed");
      // フォールバック（表示は - にせず 0/日数 で維持したいので days=1）
      thisWeek = rateBlock(0, 1);
    }

    // ---- 今月（1日始まり） ----
    try {
      const y = nowJst.getUTCFullYear();
      const m1to12 = nowJst.getUTCMonth() + 1;
      const monthStartJst = jstMidnightUtcDate(y, m1to12, 1);
      const monthStartKey = dateKeyFromJst(monthStartJst);
      const monthEndKey = todayKey;
      const dayOfMonth = nowJst.getUTCDate(); // 1..31

      const monthHit = await hitCountByDateKeyRange({
        db,
        uid,
        startKey: monthStartKey,
        endKey: monthEndKey,
      });
      thisMonth = rateBlock(monthHit, dayOfMonth);
    } catch (e: any) {
      console.error("[stats] thisMonth failed:", e);
      partialErrors.push(isIndexError(e) ? "thisMonth_requires_index" : "thisMonth_failed");
      thisMonth = rateBlock(0, 1);
    }

    // ---- 月ごとの達成率サマリー（直近12ヶ月：今月含む）----
    try {
      const y = nowJst.getUTCFullYear();
      const m1to12 = nowJst.getUTCMonth() + 1;
      const base = jstMidnightUtcDate(y, m1to12, 1);

      const months: Array<{
        ym: string;
        startKey: string;
        endKey: string;
        hit: number;
        days: number;
        rate: number;
        rank: Rank;
      }> = [];

      for (let i = 0; i < 12; i++) {
        const start = addMonthsJstMidnight(base, -i); // iヶ月前の1日
        const sy = start.getUTCFullYear();
        const sm = start.getUTCMonth() + 1;
        const days = daysInMonthJst(sy, sm);

        const startKey = dateKeyFromJst(start);
        const end = jstMidnightUtcDate(sy, sm, days); // その月の最終日(JST)
        const endKey = dateKeyFromJst(end);

        const hit = await hitCountByDateKeyRange({ db, uid, startKey, endKey });
        const rb = rateBlock(hit, days);

        months.push({
          ym: `${sy}-${String(sm).padStart(2, "0")}`,
          startKey,
          endKey,
          hit,
          days,
          rate: rb.rate,
          rank: rb.rank,
        });
      }

      monthlySummary = months;
    } catch (e: any) {
      console.error("[stats] monthlySummary failed:", e);
      partialErrors.push(isIndexError(e) ? "monthlySummary_requires_index" : "monthlySummary_failed");
      monthlySummary = [];
    }

    // ---- 合計学習ログ数 ----
    try {
      const totalQuery = db.collection("studyLogs").where("uid", "==", uid);
      totalStudyLogs = await countDocs(totalQuery);
    } catch (e: any) {
      console.error("[stats] totalStudyLogs failed:", e);
      partialErrors.push("totalStudyLogs_failed");
      totalStudyLogs = 0;
    }

    // ---- 直近ログ（最大120） ----
    try {
      const recentSnap = await db
        .collection("studyLogs")
        .where("uid", "==", uid)
        .orderBy("dateKey", "desc")
        .limit(120)
        .get();

      items = recentSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e: any) {
      console.error("[stats] items failed:", e);
      partialErrors.push(isIndexError(e) ? "items_requires_index" : "items_failed");
      items = [];
    }

    return NextResponse.json({
      ok: true,
      totalStudyLogs,
      todayKey,
      thisWeek,
      thisMonth,
      monthlySummary,
      items,

      // UI表示は変えない想定だけど、デバッグ用に付けても壊れない（使わなければ無視される）
      partialErrors: partialErrors.length ? partialErrors : undefined,
    });
  } catch (e: any) {
    // 認証失敗など「致命的」は従来通り ok:false
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown_error" }, { status: 400 });
  }
}