"use client";

import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/src/lib/firebase";
import { useRouter } from "next/navigation";
import "../app.css";
import AppHeader from "../components/AppHeader";

type Rank = "S" | "A" | "B" | "C";
type RateBlock = { hit: number; days: number; rate: number; rank: Rank };

type MonthlyItem = {
  ym: string;
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

type PausedPeriod = { start: string; end: string };

type CalendarResp =
  | { ok: true; count: number; dateKeys: string[]; pausedPeriods?: PausedPeriod[]; currentlyPaused?: boolean; pausedAt?: string | null }
  | { ok: false; error: string };

function pct(v: number) {
  return `${Math.round(v * 100)}%`;
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
  const [nickname, setNickname] = useState("");
  const [emailVerified, setEmailVerified] = useState(true);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [sendingVerify, setSendingVerify] = useState(false);

  const [loadingStats, setLoadingStats] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [createdAtKey, setCreatedAtKey] = useState<string | null>(null);

  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [calendarSet, setCalendarSet] = useState<Set<string>>(new Set());
  const [pausedSet, setPausedSet] = useState<Set<string>>(new Set());
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
      if (!u) { router.replace("/login"); return; }
      if (!u.emailVerified) { router.replace("/verify-email"); return; }
      setEmailVerified(u.emailVerified);
    });
    return () => unsub();
  }, [router]);

  const resendVerification = async () => {
    if (!user) return;
    setSendingVerify(true);
    setVerifyMsg(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/send-verification", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        setVerifyMsg("認証メールを送信しました。受信トレイを確認してください。");
      } else {
        setVerifyMsg("送信に失敗しました。しばらくしてから再度お試しください。");
      }
    } catch {
      setVerifyMsg("送信に失敗しました。しばらくしてから再度お試しください。");
    } finally {
      setSendingVerify(false);
    }
  };

  const checkVerified = async () => {
    if (!user) return;
    await user.reload();
    setEmailVerified(user.emailVerified);
    if (user.emailVerified) {
      setVerifyMsg(null);
    } else {
      setVerifyMsg("まだ認証が完了していません。メール内のリンクをクリックしてください。");
    }
  };

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
        setCalendarError("カレンダーの取得に失敗しました。");
        setCalendarSet(new Set());
        setPausedSet(new Set());
        setCalendarCount(0);
        return;
      }

      const json = (await res.json()) as CalendarResp;

      if (!json.ok) {
        setCalendarError("カレンダーの取得に失敗しました。");
        setCalendarSet(new Set());
        setPausedSet(new Set());
        setCalendarCount(0);
        return;
      }

      const set = new Set<string>();
      for (const raw of json.dateKeys ?? []) {
        const k = normalizeDateKey(raw);
        if (k) set.add(k);
      }

      // Build paused dates set
      const paused = new Set<string>();
      const periods = json.pausedPeriods ?? [];
      for (const p of periods) {
        const start = new Date(p.start + "T00:00:00Z");
        const end = new Date(p.end + "T00:00:00Z");
        for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
          const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
          paused.add(key);
        }
      }
      // Currently paused
      if (json.currentlyPaused && json.pausedAt) {
        const start = new Date(json.pausedAt + "T00:00:00Z");
        const today = new Date();
        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        const end = new Date(todayKey + "T00:00:00Z");
        for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
          const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
          paused.add(key);
        }
      }

      setCalendarSet(set);
      setPausedSet(paused);
      setCalendarCount(set.size);
    } finally {
      setLoadingCalendar(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchStats().catch(() => {});
    fetchCalendar().catch(() => {});
    const loadNickname = async () => {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setNickname(snap.data().nickname ?? "");
        const ca = snap.data().createdAt;
        if (ca) {
          const d = ca.toDate ? ca.toDate() : new Date(ca);
          setCreatedAtKey(ymdJst(d));
        }
      }
    };
    loadNickname().catch(() => {});

    // ページがフォアグラウンドに戻ったら再取得（配信停止の切替をリアルタイム反映）
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchStats().catch(() => {});
        fetchCalendar().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
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

  if (loadingAuth) {
    return (
      <div className="app-page">
        <AppHeader />
        <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 56px)" }}>
          <p style={{ color: "#6B7280" }}>Loading...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app-page">
      <AppHeader />
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Email verification banner */}
          {!emailVerified && (
            <div className="app-warning">
              <div style={{ marginBottom: 8 }}>
                メールアドレスが未認証です。受信トレイを確認し、認証リンクをクリックしてください。
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={resendVerification} disabled={sendingVerify} className="app-btn-secondary" style={{ padding: "6px 16px", fontSize: 13 }}>
                  {sendingVerify ? "送信中..." : "認証メールを再送する"}
                </button>
                <button onClick={checkVerified} className="app-btn-secondary" style={{ padding: "6px 16px", fontSize: 13 }}>
                  認証済みです
                </button>
              </div>
              {verifyMsg && <div style={{ marginTop: 8, fontSize: 13 }}>{verifyMsg}</div>}
            </div>
          )}

          {/* Page title */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 4 }}>ダッシュボード</h1>
              <p style={{ fontSize: 14, color: "#6B7280" }}>{nickname || user?.email || ""}様</p>
            </div>
            <button
              onClick={refreshAll}
              disabled={loadingStats || loadingCalendar}
              className="app-btn-secondary"
              style={{ padding: "8px 20px", fontSize: 13 }}
            >
              {loadingStats || loadingCalendar ? "更新中..." : "更新"}
            </button>
          </div>

          {err && <div className="app-error">エラーが発生しました。しばらくしてから再度お試しください。</div>}

          {/* Loading state */}
          {(loadingStats || loadingCalendar) && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: 16 }}>
              <div className="loading-spinner" />
              <p style={{ fontSize: 14, color: "#6B7280" }}>あなたの学習記録を読み込んでいます...</p>
            </div>
          )}

          {!loadingStats && !loadingCalendar && stats?.ok ? (
            <>
              {/* Stats cards */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">これまでの学習日数</div>
                  <div>
                    <span className="stat-value">{calendarCount}</span>
                    <span className="stat-unit">日</span>
                  </div>
                </div>

                <div className="stat-card">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div className="stat-label">今週の達成率</div>
                    {stats.thisWeek?.rank && (
                      <span className={`rank-badge rank-${stats.thisWeek.rank}`}>{stats.thisWeek.rank}</span>
                    )}
                  </div>
                  <div className="stat-value" style={{ marginTop: 4 }}>
                    {stats.thisWeek ? pct(stats.thisWeek.rate) : "-"}
                  </div>
                  <div className="stat-sub">
                    {stats.thisWeek?.hit ?? 0}/{stats.thisWeek?.days ?? 0} 日
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: "#9CA3AF", lineHeight: 1.6 }}>
                    S: 100% / A: 80% / B: 50% / C: 50%未満
                  </div>
                </div>

                <div className="stat-card">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div className="stat-label">今月の達成率</div>
                    {stats.thisMonth?.rank && (
                      <span className={`rank-badge rank-${stats.thisMonth.rank}`}>{stats.thisMonth.rank}</span>
                    )}
                  </div>
                  <div className="stat-value" style={{ marginTop: 4 }}>
                    {stats.thisMonth ? pct(stats.thisMonth.rate) : "-"}
                  </div>
                  <div className="stat-sub">
                    {stats.thisMonth?.hit ?? 0}/{stats.thisMonth?.days ?? 0} 日
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: "#9CA3AF", lineHeight: 1.6 }}>
                    S: 100% / A: 80% / B: 50% / C: 50%未満
                  </div>
                </div>
              </div>

              {/* Calendar */}
              <CalendarHeatmap
                studiedSet={calendarSet}
                pausedSet={pausedSet}
                cursor={calendarCursor}
                setCursor={setCalendarCursor}
                monthSummary={selectedMonthSummary}
                createdAtKey={createdAtKey}
                todayKey={stats.todayKey ?? ymdJst(new Date())}
              />

              {/* Study logs table */}
              <div className="app-card">
                <h2 className="section-title">学習ログ</h2>
                {(stats.items ?? []).length === 0 ? (
                  <p style={{ fontSize: 14, color: "#6B7280" }}>まだログがありません</p>
                ) : (
                  <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #E8EAED" }}>
                    <table className="app-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: "center" }}>日付</th>
                          <th style={{ textAlign: "center" }}>読んだメール数（合計 {stats.totalStudyLogs ?? 0}通）</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(stats.items ?? []).map((l: any) => (
                          <tr key={l.id}>
                            <td style={{ fontFamily: "monospace", textAlign: "center" }}>{(l.dateKey ?? "-").replaceAll("-", "/")}</td>
                            <td style={{ textAlign: "center" }}>{l.readCount ?? 1}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="app-card" style={{ fontSize: 14, color: "#6B7280" }}>
              「更新」を押すと統計を取得します。
            </div>
          )}

        </div>
      </main>
    </div>
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
  pausedSet,
  cursor,
  setCursor,
  monthSummary,
  createdAtKey,
  todayKey,
}: {
  studiedSet: Set<string>;
  pausedSet: Set<string>;
  cursor: Date;
  setCursor: Dispatch<SetStateAction<Date>>;
  monthSummary: MonthlyItem | null;
  createdAtKey: string | null;
  todayKey: string;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay();

  const cells: Array<{ key: string; day: number; studied: boolean; paused: boolean; beforeReg: boolean; isToday: boolean } | null> = [];
  for (let i = 0; i < leading; i++) cells.push(null);

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const key = ymdJst(date);
    const beforeReg = createdAtKey ? key < createdAtKey : false;
    cells.push({ key, day, studied: studiedSet.has(key), paused: pausedSet.has(key), beforeReg, isToday: key === todayKey });
  }

  while (cells.length < 42) cells.push(null);

  const monthLabel = `${year}年${month + 1}月`;
  const rateText = monthSummary ? pct(monthSummary.rate) : "-";
  const daysText = monthSummary ? `${monthSummary.hit}日/${monthSummary.days}日` : "-日/-日";

  return (
    <div className="app-card">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>カレンダー</h2>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>{monthLabel}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 14, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 600, color: "#1d1f42" }}>達成率 {rateText}</div>
          <div style={{ color: "#6B7280" }}>{daysText}</div>
        </div>
      </div>

      {/* Month nav */}
      <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={() => setCursor((d) => addMonths(d, -1))} className="app-btn-secondary" style={{ padding: "6px 14px", fontSize: 13 }}>
          &larr;
        </button>
        <button onClick={() => setCursor((d) => addMonths(d, 1))} className="app-btn-secondary" style={{ padding: "6px 14px", fontSize: 13 }}>
          &rarr;
        </button>
      </div>

      {/* Day headers */}
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, fontSize: 12, color: "#6B7280", textAlign: "center" }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      {/* Cells */}
      <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {cells.map((c, idx) => {
          if (!c) return <div key={idx} style={{ height: 40, borderRadius: 8 }} />;

          const bg = c.isToday ? "#FFF9E0" : c.paused ? "#F9FAFB" : "#fff";

          return (
            <div
              key={c.key}
              style={{
                position: "relative",
                height: 40,
                borderRadius: 8,
                border: "1px solid #E8EAED",
                background: bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title={c.beforeReg ? `${c.key}（登録前）` : c.paused ? `${c.key}（配信停止中）` : c.key}
            >
              <div style={{ position: "absolute", left: 4, top: 3, fontSize: 10, color: "#6B7280" }}>{c.day}</div>
              {c.beforeReg ? (
                <div style={{ fontSize: 14, color: "#9CA3AF" }}>ー</div>
              ) : (
                <>
                  {c.studied && <div className="calendar-dot" />}
                  {c.paused && !c.studied && (
                    <div style={{
                      height: 20,
                      width: 20,
                      borderRadius: "50%",
                      background: "#D1D5DB",
                    }} />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 16, fontSize: 12, color: "#6B7280" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="calendar-dot" style={{ height: 12, width: 12 }} />
          <span>学習記録あり</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ height: 12, width: 12, borderRadius: "50%", background: "#D1D5DB", display: "inline-block" }} />
          <span>配信停止日</span>
        </div>
      </div>
    </div>
  );
}
