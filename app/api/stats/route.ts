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

function daysBetweenKeys(startKey: string, endKey: string): number {
  const s = new Date(startKey + "T00:00:00Z");
  const e = new Date(endKey + "T00:00:00Z");
  return Math.round((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000)) + 1;
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

    const nowLogical = logicalJstNow();
    const todayKey = dateKeyFromJst(nowLogical);

    // ユーザーの起点日を取得（トライアル開始日 or 登録日より前を計算から除外）
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.exists ? (userSnap.data() as any) : null;
    let createdAtKey: string | null = null;
    const rawOrigin = userData?.trialStartedAt ?? userData?.createdAt;
    if (rawOrigin) {
      const ts = rawOrigin.toDate
        ? rawOrigin.toDate()
        : new Date(rawOrigin);
      const createdLogical = new Date(ts.getTime() + 5 * 60 * 60 * 1000);
      createdAtKey = dateKeyFromJst(createdLogical);
    }

    // 一時停止期間を取得
    const pausedPeriods = (userData?.pausedPeriods ?? []) as Array<{ start: string; end: string }>;
    const currentlyPaused = Boolean(userData?.deliveryPaused);
    const pausedAt = userData?.pausedAt as string | null;
    const deliveryDays: number[] = Array.isArray(userData?.deliveryDays) ? userData.deliveryDays : [0,1,2,3,4,5,6];

    // 指定期間内の一時停止日数を計算するヘルパー（Setで重複排除）
    function countPausedDaysInRange(rangeStart: string, rangeEnd: string): number {
      const pausedDateSet = new Set<string>();

      for (const period of pausedPeriods) {
        const pStart = period.start > rangeStart ? period.start : rangeStart;
        const pEnd = period.end < rangeEnd ? period.end : rangeEnd;
        if (pStart <= pEnd) {
          const s = new Date(pStart + "T00:00:00Z");
          const e = new Date(pEnd + "T00:00:00Z");
          for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
            pausedDateSet.add(dateKeyFromJst(d));
          }
        }
      }

      // 現在一時停止中の場合
      if (currentlyPaused && pausedAt) {
        const pStart = pausedAt > rangeStart ? pausedAt : rangeStart;
        const pEnd = rangeEnd;
        if (pStart <= pEnd) {
          const s = new Date(pStart + "T00:00:00Z");
          const e = new Date(pEnd + "T00:00:00Z");
          for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
            pausedDateSet.add(dateKeyFromJst(d));
          }
        }
      }

      // 配信曜日に含まれない日も停止日としてカウント（今日以降）
      if (deliveryDays.length < 7) {
        const rs = new Date(rangeStart + "T00:00:00Z");
        const re = new Date(rangeEnd + "T00:00:00Z");
        for (let d = new Date(rs); d <= re; d.setUTCDate(d.getUTCDate() + 1)) {
          const dk = dateKeyFromJst(d);
          if (dk < todayKey) continue;
          const dow = (d.getUTCDay() + 6) % 7; // 0=月, 6=日
          if (!deliveryDays.includes(dow)) {
            pausedDateSet.add(dk);
          }
        }
      }

      // 学習記録がある日は停止日としてカウントしない
      for (const dk of allDateKeys) {
        pausedDateSet.delete(dk);
      }
      // 配信停止が解除されている場合、配信曜日に含まれる今日は停止日としてカウントしない
      if (!currentlyPaused) {
        const todayDateObj = new Date(todayKey + "T00:00:00Z");
        const todayDow = (todayDateObj.getUTCDay() + 6) % 7;
        const isTodayNonDelivery = deliveryDays.length < 7 && !deliveryDays.includes(todayDow);
        if (!isTodayNonDelivery) {
          pausedDateSet.delete(todayKey);
        }
      }
      return pausedDateSet.size;
    }

    // 指定日が一時停止中かどうかを判定（学習した日は停止扱いしない）
    function isDatePaused(dateKey: string): boolean {
      if (allDateKeys.has(dateKey)) return false;
      // 配信曜日チェック（今日以降）
      if (deliveryDays.length < 7 && dateKey >= todayKey) {
        const d = new Date(dateKey + "T00:00:00Z");
        const dow = (d.getUTCDay() + 6) % 7;
        if (!deliveryDays.includes(dow)) return true;
      }
      if (!currentlyPaused && dateKey === todayKey) return false;
      for (const period of pausedPeriods) {
        if (dateKey >= period.start && dateKey <= period.end) return true;
      }
      if (currentlyPaused && pausedAt && dateKey >= pausedAt) return true;
      return false;
    }

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
    const y = nowLogical.getUTCFullYear();
    const m1to12 = nowLogical.getUTCMonth() + 1;
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

    // ---- 合計読んだメール数（全studyLogの readCount を合算） ----
    const fetchTotal = async () => {
      const snap = await db
        .collection("studyLogs")
        .where("uid", "==", uid)
        .select("readCount")
        .get();
      let sum = 0;
      for (const d of snap.docs) {
        sum += Number((d.data() as any).readCount ?? 1);
      }
      return sum;
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
      const dow = nowLogical.getUTCDay(); // 0=日, 1=月, ..., 6=土
      const mondayOffset = dow === 0 ? -6 : -(dow - 1); // 月曜までの日数
      const mondayJst = addDaysUtc(
        jstMidnightUtcDate(y, m1to12, nowLogical.getUTCDate()),
        mondayOffset
      );
      let weekStartKey = dateKeyFromJst(mondayJst);

      // createdAt より前の日を除外
      if (createdAtKey && createdAtKey > weekStartKey) {
        weekStartKey = createdAtKey;
      }

      const totalWeekDays = weekStartKey <= todayKey ? daysBetweenKeys(weekStartKey, todayKey) : 0;
      const pausedWeekDays = countPausedDaysInRange(weekStartKey, todayKey);
      const weekDays = Math.max(0, totalWeekDays - pausedWeekDays);

      let weekHit = 0;
      for (const k of allDateKeys) {
        if (k >= weekStartKey && k <= todayKey) weekHit++;
      }
      thisWeek = rateBlock(weekHit, Math.max(1, weekDays));
    } catch (e: any) {
      console.error("[stats] thisWeek failed:", e);
      partialErrors.push("thisWeek_failed");
    }

    // ---- 今月（1日始まり） ----
    try {
      let monthStartKey = dateKeyFromJst(base);

      // createdAt より前の日を除外
      if (createdAtKey && createdAtKey > monthStartKey) {
        monthStartKey = createdAtKey;
      }

      const totalMonthDays = monthStartKey <= todayKey ? daysBetweenKeys(monthStartKey, todayKey) : 0;
      const pausedMonthDays = countPausedDaysInRange(monthStartKey, todayKey);
      const monthDays = Math.max(0, totalMonthDays - pausedMonthDays);

      let monthHit = 0;
      for (const k of allDateKeys) {
        if (k >= monthStartKey && k <= todayKey) monthHit++;
      }
      thisMonth = rateBlock(monthHit, Math.max(1, monthDays));
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
        const totalDaysInMonth = daysInMonthJst(sy, sm);

        let startKey = dateKeyFromJst(start);
        const end = jstMidnightUtcDate(sy, sm, totalDaysInMonth);
        // 当月以降は今日までに制限（未来の日を分母に含めない）
        const rawEndKey = dateKeyFromJst(end);
        const endKey = rawEndKey > todayKey ? todayKey : rawEndKey;

        // createdAt より前の日を除外
        if (createdAtKey && createdAtKey > startKey) {
          startKey = createdAtKey;
        }

        // 登録前の月はスキップ
        if (startKey > endKey) {
          months.push({
            ym: `${sy}-${String(sm).padStart(2, "0")}`,
            startKey: dateKeyFromJst(start), endKey, hit: 0, days: totalDaysInMonth, rate: 0, rank: "C",
          });
          continue;
        }

        const totalDays = daysBetweenKeys(startKey, endKey);
        const pausedDays = countPausedDaysInRange(startKey, endKey);
        const days = Math.max(0, totalDays - pausedDays);

        let hit = 0;
        for (const k of allDateKeys) {
          if (k >= startKey && k <= endKey) hit++;
        }
        const rb = rateBlock(hit, Math.max(1, days));

        months.push({
          ym: `${sy}-${String(sm).padStart(2, "0")}`,
          startKey: dateKeyFromJst(start), endKey, hit, days, rate: rb.rate, rank: rb.rank,
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
