import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebaseClient";

type Rank = "S" | "A" | "B" | "C";
type RateBlock = { hit: number; days: number; rate: number; rank: Rank };

function rankOf(rate: number): Rank {
  if (rate >= 0.95) return "S";
  if (rate >= 0.8) return "A";
  if (rate >= 0.5) return "B";
  return "C";
}

// ---- JST helpers ----
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
  return new Date(Date.UTC(y, m1to12 - 1, d1to31, 0, 0, 0));
}
function addDaysUtc(d: Date, n: number) {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}
function addMonthsJstMidnight(baseJstMidnightUtc: Date, n: number) {
  const y = baseJstMidnightUtc.getUTCFullYear();
  const m = baseJstMidnightUtc.getUTCMonth();
  return new Date(Date.UTC(y, m + n, 1, 0, 0, 0));
}
function daysInMonthJst(y: number, m1to12: number) {
  return new Date(Date.UTC(y, m1to12, 0, 0, 0, 0)).getUTCDate();
}

function rateBlock(hit: number, days: number): RateBlock {
  const safeDays = Math.max(1, days);
  const rate = Math.min(1, hit / safeDays);
  return { hit, days, rate, rank: rankOf(rate) };
}

function isIndexError(e: any) {
  const msg = String(e?.message ?? "");
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

    const nowJst = jstNow();
    const todayKey = dateKeyFromJst(nowJst);

    let thisWeek: RateBlock = rateBlock(0, 1);
    let thisMonth: RateBlock = rateBlock(0, 1);
    let monthlySummary: Array<{
      ym: string; startKey: string; endKey: string;
      hit: number; days: number; rate: number; rank: Rank;
    }> = [];
    let totalStudyLogs = 0;
    let items: any[] = [];
    const partialErrors: string[] = [];

    // 12ヶ月前の1日を起点キーとして算出
    const y = nowJst.getUTCFullYear();
    const m1to12 = nowJst.getUTCMonth() + 1;
    const base = jstMidnightUtcDate(y, m1to12, 1);
    const twelveMonthsAgo = addMonthsJstMidnight(base, -11);
    const rangeStartKey = dateKeyFromJst(twelveMonthsAgo);

    // ---- 1回のクエリで直近12ヶ月分の studyLogs を全取得 + 直近ログも兼用 ----
    const fetchAllLogs = async () => {
      const snap = await db
        .collection("studyLogs")
        .where("uid", "==", uid)
        .where("dateKey", ">=", rangeStartKey)
        .orderBy("dateKey", "desc")
        .get();
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    };

    // ---- 合計学習ログ数（aggregate count） ----
    const fetchTotal = async () => {
      const totalQuery = db.collection("studyLogs").where("uid", "==", uid);
      // @ts-ignore
      if (typeof (totalQuery as any).count === "function") {
        // @ts-ignore
        const agg = await (totalQuery as any).count().get();
        // @ts-ignore
        return Number(agg.data().count ?? 0);
      }
      const snap = await totalQuery.get();
      return snap.size;
    };

    // ---- 並列実行 ----
    const [allLogs, total] = await Promise.all([
      fetchAllLogs().catch((e: any) => {
        console.error("[stats] allLogs failed:", e);
        partialErrors.push(isIndexError(e) ? "allLogs_requires_index" : "allLogs_failed");
        return [] as any[];
      }),
      fetchTotal().catch((e: any) => {
        console.error("[stats] totalStudyLogs failed:", e);
        partialErrors.push("totalStudyLogs_failed");
        return 0;
      }),
    ]);

    totalStudyLogs = total;
    items = allLogs.slice(0, 120);

    // dateKey の Set を作成（メモリ上で集計）
    const allDateKeys = new Set<string>();
    for (const log of allLogs) {
      if (typeof log.dateKey === "string") allDateKeys.add(log.dateKey);
    }

    // ---- 今週（月曜始まり） ----
    try {
      const dow = nowJst.getUTCDay();
      const offsetFromMonday = (dow + 6) % 7;
      const mondayJst = addDaysUtc(
        jstMidnightUtcDate(y, m1to12, nowJst.getUTCDate()),
        -offsetFromMonday
      );
      const weekStartKey = dateKeyFromJst(mondayJst);
      const weekDays = offsetFromMonday + 1;

      let weekHit = 0;
      for (const k of allDateKeys) {
        if (k >= weekStartKey && k <= todayKey) weekHit++;
      }
      thisWeek = rateBlock(weekHit, weekDays);
    } catch (e: any) {
      console.error("[stats] thisWeek failed:", e);
      partialErrors.push("thisWeek_failed");
    }

    // ---- 今月（1日始まり） ----
    try {
      const monthStartKey = dateKeyFromJst(base);
      const dayOfMonth = nowJst.getUTCDate();

      let monthHit = 0;
      for (const k of allDateKeys) {
        if (k >= monthStartKey && k <= todayKey) monthHit++;
      }
      thisMonth = rateBlock(monthHit, dayOfMonth);
    } catch (e: any) {
      console.error("[stats] thisMonth failed:", e);
      partialErrors.push("thisMonth_failed");
    }

    // ---- 月ごとの達成率サマリー（直近12ヶ月）----
    try {
      const months: typeof monthlySummary = [];

      for (let i = 0; i < 12; i++) {
        const start = addMonthsJstMidnight(base, -i);
        const sy = start.getUTCFullYear();
        const sm = start.getUTCMonth() + 1;
        const days = daysInMonthJst(sy, sm);

        const startKey = dateKeyFromJst(start);
        const end = jstMidnightUtcDate(sy, sm, days);
        const endKey = dateKeyFromJst(end);

        let hit = 0;
        for (const k of allDateKeys) {
          if (k >= startKey && k <= endKey) hit++;
        }
        const rb = rateBlock(hit, days);

        months.push({
          ym: `${sy}-${String(sm).padStart(2, "0")}`,
          startKey, endKey, hit, days, rate: rb.rate, rank: rb.rank,
        });
      }
      monthlySummary = months;
    } catch (e: any) {
      console.error("[stats] monthlySummary failed:", e);
      partialErrors.push("monthlySummary_failed");
    }

    return NextResponse.json({
      ok: true,
      totalStudyLogs,
      todayKey,
      thisWeek,
      thisMonth,
      monthlySummary,
      items,
      partialErrors: partialErrors.length ? partialErrors : undefined,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
