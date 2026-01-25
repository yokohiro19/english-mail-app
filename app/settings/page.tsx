"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../src/lib/firebase";
import { useRouter } from "next/navigation";

type ExamType = "TOEIC" | "EIKEN" | "TOEFL";
type Plan = "free" | "standard";

type UserSettings = {
  email: string;
  examType: ExamType;
  examLevel: string;
  wordCount: number;
  sendTime: string;
  updatedAt?: any;
  createdAt?: any;

  // ===== Billing fields (Phase5) =====
  plan?: Plan;
  subscriptionStatus?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: any; // timestamp/date
  trialUsed?: boolean;
  trialEndsAt?: any; // timestamp/date
};

type StudyLogItem = {
  id: string;
  uid: string;
  dateKey: string;
  deliveryId: string;
  topicId?: string | null;
  cefr?: string | null;
  firstReadAt?: any;
  lastReadAt?: any;
  readCount?: number;
};

const DEFAULT_SETTINGS: Omit<UserSettings, "email"> = {
  examType: "TOEIC",
  examLevel: "TOEIC 500",
  wordCount: 150,
  sendTime: "07:00",
};

function safeNumber(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
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

function formatDateOnly(ts: any) {
  try {
    if (!ts) return null;
    const d =
      typeof ts?.toDate === "function" ? ts.toDate() : ts instanceof Date ? ts : new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("ja-JP");
  } catch {
    return null;
  }
}

export default function SettingsPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState<string | null>(null);

  const [examType, setExamType] = useState<ExamType>(DEFAULT_SETTINGS.examType);
  const [examLevel, setExamLevel] = useState(DEFAULT_SETTINGS.examLevel);
  const [wordCount, setWordCount] = useState(DEFAULT_SETTINGS.wordCount);
  const [sendTime, setSendTime] = useState(DEFAULT_SETTINGS.sendTime);

  // ===== Billing (Phase5) =====
  const [plan, setPlan] = useState<Plan>("free");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [trialUsed, setTrialUsed] = useState<boolean>(false);
  const [trialEndsAt, setTrialEndsAt] = useState<any>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<any>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState<boolean>(false);

  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  // ===== Phase4: 学習ログ =====
  const [logsLoading, setLogsLoading] = useState(false);
  const [logs, setLogs] = useState<StudyLogItem[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);

  // ===== 旧Phase2テスト（残す：折りたたみ） =====
  const [showDevTools, setShowDevTools] = useState(false);
  const [topicLoading, setTopicLoading] = useState(false);
  const [randomTopic, setRandomTopic] = useState<any>(null);

  const [genLoading, setGenLoading] = useState(false);
  const [generated, setGenerated] = useState<any>(null);

  const defaultLevelByExam: Record<ExamType, string> = useMemo(
    () => ({
      TOEIC: "TOEIC 500",
      EIKEN: "英検 2級",
      TOEFL: "TOEFL 80",
    }),
    []
  );

  // ログイン状態監視
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoadingAuth(false);

      if (!u) {
        router.replace("/login");
        return;
      }
    });

    return () => unsub();
  }, [router]);

  // Firestoreから設定ロード
  const loadUserDoc = async (u: User) => {
    setLoadingData(true);
    setMessage(null);

    const ref = doc(db, "users", u.uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data() as Partial<UserSettings>;
      const loadedExamType = (data.examType as ExamType) ?? DEFAULT_SETTINGS.examType;

      setExamType(loadedExamType);
      setExamLevel(data.examLevel ?? defaultLevelByExam[loadedExamType] ?? DEFAULT_SETTINGS.examLevel);
      setWordCount(
        typeof data.wordCount === "number"
          ? data.wordCount
          : safeNumber(data.wordCount, DEFAULT_SETTINGS.wordCount)
      );
      setSendTime(data.sendTime ?? DEFAULT_SETTINGS.sendTime);

      // ===== Billing fields =====
      setPlan((data.plan as Plan) ?? "free");
      setSubscriptionStatus((data.subscriptionStatus as any) ?? null);
      setTrialUsed(Boolean(data.trialUsed));
      setTrialEndsAt((data.trialEndsAt as any) ?? null);
      setCurrentPeriodEnd((data.currentPeriodEnd as any) ?? null);
      setCancelAtPeriodEnd(Boolean(data.cancelAtPeriodEnd));
    } else {
      await setDoc(
        ref,
        {
          email: u.email ?? "",
          ...DEFAULT_SETTINGS,
          plan: "free",
          trialUsed: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    setLoadingData(false);
  };

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      await loadUserDoc(user);
    };

    run().catch((e) => {
      console.error(e);
      setMessage("読み込みに失敗しました。");
      setLoadingData(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, defaultLevelByExam]);

  const onSave = async () => {
    if (!user) return;

    setSaving(true);
    setMessage(null);

    try {
      const ref = doc(db, "users", user.uid);
      await setDoc(
        ref,
        {
          email: user.email ?? "",
          examType,
          examLevel,
          wordCount,
          sendTime,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setMessage("保存しました ✅");
    } catch (e) {
      console.error(e);
      setMessage("保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  // ===== Phase4: 学習ログ取得 =====
  const fetchLogs = async () => {
    if (!user) return;
    setLogsLoading(true);
    setLogsError(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/logs", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();

      if (!res.ok) {
        setLogs([]);
        setLogsError(json?.error ? String(json.error) : "ログ取得に失敗しました。");
        return;
      }

      setLogs((json?.items ?? []).map((x: any) => x) as StudyLogItem[]);
    } catch (e: any) {
      console.error(e);
      setLogs([]);
      setLogsError("ログ取得に失敗しました。");
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchLogs().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ===== Billing actions =====
  const refreshBilling = async () => {
    if (!user) return;
    setBillingLoading(true);
    setBillingError(null);
    try {
      await loadUserDoc(user);
    } catch (e: any) {
      console.error(e);
      setBillingError("課金状態の再取得に失敗しました。");
    } finally {
      setBillingLoading(false);
    }
  };

  const goCheckout = async () => {
    if (!user) return;
    setBillingLoading(true);
    setBillingError(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trialDays: 7,
          successPath: "/settings?billing=success",
          cancelPath: "/settings?billing=cancel",
        }),
      });

      const json = await res.json().catch(() => ({}));

      // ✅ ここが肝：既に契約があるなら、説明を出すよりポータルへ誘導
      if (json?.code === "subscription_exists") {
        // すぐ飛ばす（エラー表示しない）
        await openPortalInternal("/settings");
        return;
      }

      if (!res.ok || !json?.ok || !json?.url) {
        setBillingError(json?.error ? String(json.error) : "課金処理に失敗しました。");
        return;
      }

      window.location.href = json.url;
    } catch (e: any) {
      console.error(e);
      setBillingError("課金処理に失敗しました。");
    } finally {
      setBillingLoading(false);
    }
  };

  const openPortal = async () => {
    if (!user) return;
    setBillingLoading(true);
    setBillingError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          returnPath: "/settings",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok || !json?.url) {
        setBillingError(json?.error ? String(json.error) : "ポータル起動に失敗しました。");
        return;
      }
      window.location.href = json.url;
    } catch (e: any) {
      console.error(e);
      setBillingError("ポータル起動に失敗しました。");
    } finally {
      setBillingLoading(false);
    }
  };
  
  const openPortalInternal = async (returnPath = "/settings") => {
    if (!user) throw new Error("no_user");
    const token = await user.getIdToken();

    const res = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ returnPath }),
    });

    const json = await res.json();
    if (!res.ok || !json?.ok || !json?.url) {
      throw new Error(json?.error ? String(json.error) : "portal_failed");
    }

    window.location.href = json.url;
  };


  // ===== 旧Phase2テスト =====
  const fetchRandomTopic = async () => {
    setTopicLoading(true);
    setRandomTopic(null);
    setMessage(null);

    try {
      const res = await fetch("/api/topic/random", { method: "GET" });
      const json = await res.json();
      setRandomTopic(json);

      if (!res.ok) {
        setMessage(json?.error ? `トピック取得に失敗: ${json.error}` : "トピック取得に失敗しました。");
      }
    } catch (e) {
      console.error(e);
      setMessage("トピック取得に失敗しました。");
    } finally {
      setTopicLoading(false);
    }
  };

  const generateTestEmail = async () => {
    if (!user) return;

    setGenLoading(true);
    setGenerated(null);
    setMessage(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setGenerated(json);

      if (!res.ok) {
        setMessage(json?.error ? `生成に失敗: ${json.error}` : "生成に失敗しました。");
      }
    } catch (e) {
      console.error(e);
      setMessage("生成に失敗しました。");
    } finally {
      setGenLoading(false);
    }
  };

  const examTypeLabel = useMemo(() => {
    if (examType === "TOEIC") return "TOEIC";
    if (examType === "EIKEN") return "英検";
    return "TOEFL iBT";
  }, [examType]);

  // ===== Billing display logic =====
  const showFreeTrialLabel = plan === "free" && trialUsed === false;
  const upgradeLabel = showFreeTrialLabel
    ? "Standardにアップグレード（7日無料）"
    : "Standardにアップグレード（トライアル利用済み）";

  // 「トライアル中キャンセル済み」表示（あなたの現在状態がこれ）
  const cancelledDuringTrial =
    plan === "free" && subscriptionStatus === "trialing" && Boolean(trialEndsAt);

  const trialUntilText = cancelledDuringTrial ? formatDateOnly(trialEndsAt) : null;

  if (loadingAuth || loadingData) return <p className="p-6">Loading...</p>;

  return (
    <main className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-3xl space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-gray-600">
            Logged in as: <span className="font-mono">{user?.email}</span>
          </p>
        </div>

        {/* Billing */}
        <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">プラン</h2>
              <p className="text-xs text-gray-500">
                plan / subscriptionStatus は webhook から自動反映されます
              </p>
            </div>
            <button
              onClick={refreshBilling}
              disabled={billingLoading}
              className="rounded border px-3 py-2 text-sm disabled:opacity-50"
            >
              {billingLoading ? "更新中..." : "更新"}
            </button>
          </div>

          <div className="rounded border bg-gray-50 p-3 text-sm">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <div>
                現在プラン：<span className="font-bold">{plan}</span>
              </div>
              <div>
                状態：<span className="font-mono">{subscriptionStatus ?? "-"}</span>
              </div>
              <div>
                トライアル利用済み：<span className="font-bold">{trialUsed ? "YES" : "NO"}</span>
              </div>
            </div>

            {cancelledDuringTrial && (
              <div className="mt-2 text-xs text-gray-700">
                ✅ 無料トライアルはキャンセル済みです
                {trialUntilText ? `（トライアル期限：${trialUntilText}まで）` : ""}
                <div className="text-gray-500 mt-1">
                  ※ Stripe上は trialing のままでも、配信停止のため plan は free 扱いにしています
                </div>
              </div>
            )}

            {plan === "standard" && currentPeriodEnd && (
              <div className="mt-2 text-xs text-gray-700">
                次回更新/期限：{formatTs(currentPeriodEnd)}
                {cancelAtPeriodEnd && <span className="ml-2 text-gray-500">（キャンセル予約中）</span>}
              </div>
            )}
          </div>

          {billingError && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              課金処理エラー: {billingError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {plan === "standard" ? (
              <button
                onClick={openPortal}
                disabled={billingLoading}
                className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
              >
                {billingLoading ? "起動中..." : "請求/解約を管理"}
              </button>
            ) : (
              <button
                onClick={goCheckout}
                disabled={billingLoading}
                className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
              >
                {billingLoading ? "処理中..." : upgradeLabel}
              </button>
            )}

            <p className="text-xs text-gray-500">
              ※ トライアルは一度だけ（trialUsed=true の場合はトライアル無しで開始します）
            </p>
          </div>
        </section>

        {/* Settings */}
        <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">配信設定</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">試験</label>
              <select
                className="w-full rounded border p-2"
                value={examType}
                onChange={(e) => {
                  const v = e.target.value as ExamType;
                  setExamType(v);
                  setExamLevel(defaultLevelByExam[v]);
                }}
              >
                <option value="TOEIC">TOEIC</option>
                <option value="EIKEN">英検</option>
                <option value="TOEFL">TOEFL iBT</option>
              </select>
              <p className="text-xs text-gray-500">現在の選択：{examTypeLabel}</p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">配信時間（JST）</label>
              <input
                className="w-full rounded border p-2"
                type="time"
                value={sendTime}
                onChange={(e) => setSendTime(e.target.value)}
              />
              <p className="text-xs text-gray-500">Cronはこの時刻に一致するユーザーへ送信します</p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">レベル</label>
              <input
                className="w-full rounded border p-2"
                value={examLevel}
                onChange={(e) => setExamLevel(e.target.value)}
                placeholder="例：TOEIC 500 / 英検 2級 / TOEFL 80"
              />
              <p className="text-xs text-gray-500">今は自由入力（次のPhaseでプルダウン化）</p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">文字数（words）</label>
              <input
                className="w-full rounded border p-2"
                type="number"
                min={50}
                max={800}
                value={wordCount}
                onChange={(e) => setWordCount(Number(e.target.value))}
              />
              <p className="text-xs text-gray-500">目安：100〜250が読みやすい</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onSave}
              disabled={saving}
              className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>

            {message && <p className="text-sm">{message}</p>}
          </div>
        </section>

        {/* Study Logs */}
        <section className="space-y-3 rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">学習ログ（Phase4）</h2>
              <p className="text-xs text-gray-500">メールの「✅ 読んだ」を押すと studyLogs に記録されます</p>
            </div>
            <button
              onClick={fetchLogs}
              disabled={logsLoading}
              className="rounded border px-3 py-2 disabled:opacity-50"
            >
              {logsLoading ? "更新中..." : "更新"}
            </button>
          </div>

          {logsError && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              ログ取得エラー: {logsError}
              <div className="mt-1 text-xs text-red-700/80 space-y-1">
                <div>※ Firestore の複合インデックスが未作成の場合に発生します</div>
                <div>※ 初回は Firebase Console のリンクから index を作成してください</div>
              </div>
            </div>
          )}

          {logs.length === 0 && !logsError ? (
            <div className="rounded border bg-gray-50 p-3 text-sm text-gray-600">
              まだログがありません（メールの「✅ 読んだ」を押すとここに出ます）
            </div>
          ) : (
            <div className="overflow-auto rounded border">
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
                  {logs.map((l) => (
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
          )}

          <details className="rounded border bg-gray-50 p-3">
            <summary className="cursor-pointer text-sm font-medium">JSONを表示（デバッグ）</summary>
            <pre className="mt-2 text-xs overflow-auto">{JSON.stringify(logs, null, 2)}</pre>
          </details>
        </section>

        {/* Dev Tools (旧Phase2テスト) */}
        <section className="space-y-3 rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">開発用ツール（任意）</h2>
            <button onClick={() => setShowDevTools((v) => !v)} className="rounded border px-3 py-2">
              {showDevTools ? "閉じる" : "開く"}
            </button>
          </div>

          {!showDevTools ? (
            <p className="text-sm text-gray-500">※ Phase4では不要。動作確認用に残しています。</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2 rounded border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">Random Topic</h3>
                  <button
                    onClick={fetchRandomTopic}
                    disabled={topicLoading}
                    className="rounded border px-3 py-2 disabled:opacity-50"
                  >
                    {topicLoading ? "取得中..." : "Get"}
                  </button>
                </div>

                {randomTopic && (
                  <pre className="bg-gray-100 p-3 text-xs overflow-auto rounded">
                    {JSON.stringify(randomTopic, null, 2)}
                  </pre>
                )}
              </div>

              <div className="space-y-2 rounded border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">Generate Test Email</h3>
                  <button
                    onClick={generateTestEmail}
                    disabled={genLoading}
                    className="rounded border px-3 py-2 disabled:opacity-50"
                  >
                    {genLoading ? "生成中..." : "Generate"}
                  </button>
                </div>

                {generated && (
                  <pre className="bg-gray-100 p-3 text-xs overflow-auto rounded">
                    {JSON.stringify(generated, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </section>

        <div className="flex items-center justify-between">
          <button className="rounded bg-gray-200 px-4 py-2" onClick={logout}>
            Log out
          </button>

          <p className="text-xs text-gray-500">
            ※ Firestore の <span className="font-mono">users/{`{uid}`}</span> に保存
          </p>
        </div>
      </div>
    </main>
  );
}