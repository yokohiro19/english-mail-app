"use client";

import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/src/lib/firebase";
import { useRouter } from "next/navigation";

type Rank = "S" | "A" | "B" | "C";
type RateBlock = { hit: number; days: number; rate: number; rank: Rank };

type MonthlyItem = {
  ym: string; // YYYY-MM
  startKey: string;
  endKey: string;
  hit: number;
  days: number;
  rate: number;
  rank: Rank;
};

type Stats = {
  ok: boolean;
  error?: string;

  totalStudyLogs?: number;
  todayKey?: string;

  thisWeek?: RateBlock;
  thisMonth?: RateBlock;

  monthlySummary?: MonthlyItem[];
  items?: any[];
};

type CalendarResp =
  | { ok: true; count: number; dateKeys: string[] }
  | { ok: false; error: string };

function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

function formatTs(ts: any) {
  try {
    if (!ts) return "-";
    if (typeof ts?.toDate === "function") return ts.toDate().toLocaleString("ja-JP");
    const d = ts instanceof Date ? ts : new Date(ts);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("ja-JP");
  } catch {
    return "-";
  }
}

function rankBadge(rank: Rank) {
  const base = "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold";
  if (rank === "S") return `${base} bg-yellow-50 border-yellow-200 text-yellow-800`;
  if (rank === "A") return `${base} bg-green-50 border-green-200 text-green-800`;
  if (rank === "B") return `${base} bg-blue-50 border-blue-200 text-blue-800`;
  return `${base} bg-gray-50 border-gray-200 text-gray-700`;
}

function normalizeDateKey(x: any): string | null {
  if (!x) return null;
  let s = String(x).trim();
  if (s.includes("T")) s = s.split("T")[0];
  s = s.replaceAll("/", "-");
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function ymFromDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [loadingStats, setLoadingStats] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [calendarSet, setCalendarSet] = useState<Set<string>>(new Set());
  const [calendarCount, setCalendarCount] = useState<number>(0);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const [calendarCursor, setCalendarCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingAuth(false);
      if (!u) router.replace("/login");
    });
    return () => unsub();
  }, [router]);

  const fetchStats = async () => {
    if (!user) return;
    setLoadingStats(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/stats", { headers: { Authorization: `Bearer ${token}` } });
      const json = (await res.json()) as Stats;
      setStats(json);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchCalendar = async () => {
    if (!user) return;
    setLoadingCalendar(true);
    setCalendarError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/calendar", { headers: { Authorization: `Bearer ${token}` } });

      if (!res.ok) {
        setCalendarError(`calendar_http_${res.status}`);
        setCalendarSet(new Set());
        setCalendarCount(0);
        return;
      }

      const json = (await res.json()) as CalendarResp;

      if (!json.ok) {
        setCalendarError(json.error);
        setCalendarSet(new Set());
        setCalendarCount(0);
        return;
      }

      const set = new Set<string>();
      for (const raw of json.dateKeys ?? []) {
        const k = normalizeDateKey(raw);
        if (k) set.add(k);
      }

      setCalendarSet(set);
      setCalendarCount(set.size);
    } finally {
      setLoadingCalendar(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchStats().catch(() => {});
    fetchCalendar().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const refreshAll = async () => {
    await Promise.all([fetchStats(), fetchCalendar()]);
  };

  const err = useMemo(() => (stats && !stats.ok ? stats.error : null), [stats]);

  const selectedYm = useMemo(() => ymFromDate(calendarCursor), [calendarCursor]);
  const selectedMonthSummary = useMemo(() => {
    const list = stats?.monthlySummary ?? [];
    return list.find((m) => m.ym === selectedYm) ?? null;
  }, [stats, selectedYm]);

  if (loadingAuth) return <div className="p-6">Loading...</div>;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-gray-600">積み上げ型の見える化（Phase5）</p>
          </div>

          <div className="flex gap-2">
            <button onClick={() => router.push("/settings")} className="rounded border bg-white px-3 py-2">
              Settings
            </button>
            <button
              onClick={refreshAll}
              disabled={loadingStats || loadingCalendar}
              className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
            >
              {loadingStats || loadingCalendar ? "更新中..." : "更新"}
            </button>
          </div>
        </div>

        {err && (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            エラー: {err}
          </div>
        )}

        {stats?.ok ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="text-xs text-gray-500">学習ログ合計</div>
                <div className="mt-1 text-3xl font-bold">{stats.totalStudyLogs ?? 0}</div>
                <div className="text-xs text-gray-500">回</div>
              </div>

              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">今週の達成率（月曜始まり）</div>
                  {stats.thisWeek?.rank && (
                    <span className={rankBadge(stats.thisWeek.rank)}>{stats.thisWeek.rank}評価</span>
                  )}
                </div>
                <div className="mt-2 text-2xl font-bold">{stats.thisWeek ? pct(stats.thisWeek.rate) : "-"}</div>
                <div className="mt-1 text-xs text-gray-600">
                  {stats.thisWeek?.hit ?? 0}/{stats.thisWeek?.days ?? 0} 日
                </div>
                <div className="mt-2 text-xs text-gray-500">※ 95%:S / 80%:A / 50%:B / それ未満:C</div>
              </div>

              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">今月の達成率（1日始まり）</div>
                  {stats.thisMonth?.rank && (
                    <span className={rankBadge(stats.thisMonth.rank)}>{stats.thisMonth.rank}評価</span>
                  )}
                </div>
                <div className="mt-2 text-2xl font-bold">{stats.thisMonth ? pct(stats.thisMonth.rate) : "-"}</div>
                <div className="mt-1 text-xs text-gray-600">
                  {stats.thisMonth?.hit ?? 0}/{stats.thisMonth?.days ?? 0} 日
                </div>
                <div className="mt-2 text-xs text-gray-500">※ 95%:S / 80%:A / 50%:B / それ未満:C</div>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">直近の学習ログ一覧</h2>
                <div className="text-xs text-gray-500">最大120件</div>
              </div>

              <div className="mt-3 overflow-auto rounded border">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left">date</th>
                      <th className="px-3 py-2 text-left">readCount</th>
                      <th className="px-3 py-2 text-left">firstReadAt</th>
                      <th className="px-3 py-2 text-left">lastReadAt</th>
                      <th className="px-3 py-2 text-left">topicId</th>
                      <th className="px-3 py-2 text-left">cefr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats.items ?? []).map((l: any) => (
                      <tr key={l.id} className="border-t">
                        <td className="px-3 py-2 font-mono">{l.dateKey ?? "-"}</td>
                        <td className="px-3 py-2">{l.readCount ?? 1}</td>
                        <td className="px-3 py-2">{formatTs(l.firstReadAt)}</td>
                        <td className="px-3 py-2">{formatTs(l.lastReadAt)}</td>
                        <td className="px-3 py-2 font-mono text-xs">{l.topicId ?? "-"}</td>
                        <td className="px-3 py-2">{l.cefr ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <CalendarHeatmap
              studiedSet={calendarSet}
              cursor={calendarCursor}
              setCursor={setCalendarCursor}
              monthSummary={selectedMonthSummary}
            />

            <div className="text-xs text-gray-500">
              {loadingCalendar && "カレンダー読み込み中..."}
              {calendarError && <span className="text-red-600">カレンダー取得エラー: {calendarError}</span>}
              {!loadingCalendar && !calendarError && <span>学習記録日数（全期間）: {calendarCount} 日</span>}
            </div>
          </>
        ) : (
          <div className="rounded border bg-white p-4 text-sm text-gray-600">「更新」を押すと統計を取得します。</div>
        )}
      </div>
    </main>
  );
}

/* ===== Calendar ===== */
function ymdJst(d: Date) {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function CalendarHeatmap({
  studiedSet,
  cursor,
  setCursor,
  monthSummary,
}: {
  studiedSet: Set<string>;
  cursor: Date;
  setCursor: Dispatch<SetStateAction<Date>>;
  monthSummary: MonthlyItem | null;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay();

  const cells: Array<{ key: string; day: number; studied: boolean } | null> = [];
  for (let i = 0; i < leading; i++) cells.push(null);

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const key = ymdJst(date);
    cells.push({ key, day, studied: studiedSet.has(key) });
  }

  while (cells.length < 42) cells.push(null);

  const monthLabel = `${year}年${month + 1}月`;

  const rateText = monthSummary ? pct(monthSummary.rate) : "-";
  const daysText = monthSummary ? `${monthSummary.hit}日/${monthSummary.days}日` : "-日/-日";

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm min-h-[200px]">
      {/* ヘッダー：左は月、右は指定の2行表示 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">カレンダー</h2>
          <div className="mt-1 text-sm font-medium text-gray-700">{monthLabel}</div>
        </div>

        <div className="text-right text-sm leading-tight">
          <div className="font-medium text-gray-800">達成率 {rateText}</div>
          <div className="text-gray-600">{daysText}</div>
        </div>
      </div>

      {/* 月移動 */}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button onClick={() => setCursor((d) => addMonths(d, -1))} className="rounded border px-3 py-2 text-sm">
          ←
        </button>
        <button onClick={() => setCursor((d) => addMonths(d, 1))} className="rounded border px-3 py-2 text-sm">
          →
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-2 text-xs text-gray-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
          <div key={w} className="text-center">
            {w}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((c, idx) => {
          if (!c) return <div key={idx} className="h-10 rounded border border-transparent" />;

          return (
            <div
              key={c.key}
              className="relative h-10 rounded border bg-white flex items-center justify-center"
              title={c.key}
            >
              <div className="absolute left-1 top-1 text-[10px] text-gray-600">{c.day}</div>
              {c.studied && <div className="h-5 w-5 rounded-full bg-blue-500" />}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
        <span className="inline-block h-3 w-3 rounded-full bg-blue-500" />
        <span>学習記録あり（全期間）</span>
      </div>
    </div>
  );
}
