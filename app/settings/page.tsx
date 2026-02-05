"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../src/lib/firebase";
import { useRouter } from "next/navigation";
import "../app.css";
import AppHeader from "../components/AppHeader";

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
  plan?: Plan;
  subscriptionStatus?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: any;
  trialUsed?: boolean;
  trialEndsAt?: any;
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

  // already_read バナー
  const [alreadyReadBanner, setAlreadyReadBanner] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("already_read") === "1") {
      setAlreadyReadBanner(true);
      const t = setTimeout(() => setAlreadyReadBanner(false), 4000);
      return () => clearTimeout(t);
    }
  }, []);

  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const [nickname, setNickname] = useState("");

  const [examType, setExamType] = useState<ExamType>(DEFAULT_SETTINGS.examType);
  const [examLevel, setExamLevel] = useState(DEFAULT_SETTINGS.examLevel);
  const [wordCount, setWordCount] = useState(DEFAULT_SETTINGS.wordCount);
  const [sendTime, setSendTime] = useState(DEFAULT_SETTINGS.sendTime);

  // Delivery email
  const [deliveryEmail, setDeliveryEmail] = useState("");
  const [deliveryEmailVerified, setDeliveryEmailVerified] = useState(false);
  const [deliveryEmailSending, setDeliveryEmailSending] = useState(false);
  const [deliveryEmailMsg, setDeliveryEmailMsg] = useState<string | null>(null);

  // Billing
  const [plan, setPlan] = useState<Plan>("free");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [trialUsed, setTrialUsed] = useState<boolean>(false);
  const [trialEndsAt, setTrialEndsAt] = useState<any>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<any>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState<boolean>(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  // Trial mail
  const [trialMailSentAt, setTrialMailSentAt] = useState<any>(null);
  const [standardStartedAt, setStandardStartedAt] = useState<any>(null);
  const [trialSending, setTrialSending] = useState(false);
  const [trialMsg, setTrialMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const levelOptionsByExam: Record<ExamType, string[]> = useMemo(
    () => ({
      TOEIC: ["TOEIC 990", "TOEIC 900", "TOEIC 800", "TOEIC 700", "TOEIC 600", "TOEIC 500", "TOEIC 400"],
      EIKEN: ["英検 1級", "英検 準1級", "英検 2級", "英検 準2級プラス", "英検 準2級", "英検 3級"],
      TOEFL: ["TOEFL 116~120", "TOEFL 109~115", "TOEFL 94~108", "TOEFL 63~93", "TOEFL 45~62", "TOEFL 30~44"],
    }),
    []
  );

  const defaultLevelByExam: Record<ExamType, string> = useMemo(
    () => ({ TOEIC: "TOEIC 500", EIKEN: "英検 2級", TOEFL: "TOEFL 63~93" }),
    []
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoadingAuth(false);
      if (!u) { router.replace("/login"); return; }
    });
    return () => unsub();
  }, [router]);

  const loadUserDoc = async (u: User) => {
    setLoadingData(true);
    setMessage(null);

    const ref = doc(db, "users", u.uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data() as Partial<UserSettings> & { nickname?: string };
      setNickname(data.nickname ?? "");
      const loadedExamType = (data.examType as ExamType) ?? DEFAULT_SETTINGS.examType;
      setExamType(loadedExamType);
      setExamLevel(data.examLevel ?? defaultLevelByExam[loadedExamType] ?? DEFAULT_SETTINGS.examLevel);
      setWordCount(typeof data.wordCount === "number" ? data.wordCount : safeNumber(data.wordCount, DEFAULT_SETTINGS.wordCount));
      setSendTime(data.sendTime ?? DEFAULT_SETTINGS.sendTime);
      setPlan((data.plan as Plan) ?? "free");
      setSubscriptionStatus((data.subscriptionStatus as any) ?? null);
      setTrialUsed(Boolean(data.trialUsed));
      setTrialEndsAt((data.trialEndsAt as any) ?? null);
      setCurrentPeriodEnd((data.currentPeriodEnd as any) ?? null);
      setCancelAtPeriodEnd(Boolean(data.cancelAtPeriodEnd));
      setDeliveryEmail((data as any).deliveryEmail ?? u.email ?? "");
      setDeliveryEmailVerified(Boolean((data as any).deliveryEmailVerified));
      setTrialMailSentAt((data as any).trialMailSentAt ?? null);
      setStandardStartedAt((data as any).standardStartedAt ?? null);
    } else {
      setDeliveryEmail(u.email ?? "");
      setDeliveryEmailVerified(false);
      await setDoc(ref, { email: u.email ?? "", ...DEFAULT_SETTINGS, plan: "free", trialUsed: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
    }
    setLoadingData(false);
  };

  useEffect(() => {
    const run = async () => { if (!user) return; await loadUserDoc(user); };
    run().catch((e) => { console.error(e); setMessage("読み込みに失敗しました。"); setMessageType("error"); setLoadingData(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, defaultLevelByExam]);

  const onSave = async () => {
    if (!user) return;
    setSaving(true);
    setMessage(null);
    try {
      const ref = doc(db, "users", user.uid);
      const isDefaultEmail = deliveryEmail === user.email;
      await setDoc(ref, {
        email: user.email ?? "",
        examType, examLevel, wordCount, sendTime,
        deliveryEmail: deliveryEmail || user.email,
        ...(isDefaultEmail ? { deliveryEmailVerified: true } : {}),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      if (isDefaultEmail) setDeliveryEmailVerified(true);
      setMessage("保存しました");
      setMessageType("success");
    } catch (e) {
      console.error(e);
      setMessage("保存に失敗しました。");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  const sendDeliveryVerification = async () => {
    if (!user || !deliveryEmail) return;
    setDeliveryEmailSending(true);
    setDeliveryEmailMsg(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/verify-delivery-email", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: deliveryEmail }),
      });
      const json = await res.json();
      if (json.ok) {
        setDeliveryEmailMsg("認証メールを送信しました。受信トレイを確認してください。");
        setDeliveryEmailVerified(false);
      } else {
        setDeliveryEmailMsg("送信に失敗しました。");
      }
    } catch {
      setDeliveryEmailMsg("送信に失敗しました。");
    } finally {
      setDeliveryEmailSending(false);
    }
  };

  const isCustomEmail = user ? deliveryEmail !== user.email : false;

  // Billing actions
  const goCheckout = async () => {
    if (!user) return;
    setBillingLoading(true);
    setBillingError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ trialDays: 7, successPath: "/settings?billing=success", cancelPath: "/settings?billing=cancel" }),
      });
      const json = await res.json().catch(() => ({}));
      if (json?.code === "subscription_exists") { await openPortalInternal("/settings"); return; }
      if (!res.ok || !json?.ok || !json?.url) { setBillingError("課金処理に失敗しました。"); return; }
      window.location.href = json.url;
    } catch {
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
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ returnPath: "/settings" }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok || !json?.url) { setBillingError("ポータル起動に失敗しました。"); return; }
      window.location.href = json.url;
    } catch {
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
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ returnPath }),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok || !json?.url) throw new Error("portal_failed");
    window.location.href = json.url;
  };

  // Display logic
  const showFreeTrialLabel = plan === "free" && trialUsed === false;
  const canRestartTrial = plan === "free" && trialUsed === true && (() => {
    if (!trialEndsAt) return false;
    const end = typeof trialEndsAt?.toDate === "function" ? trialEndsAt.toDate() : new Date(trialEndsAt);
    return end.getTime() > Date.now();
  })();

  // Trial mail button logic
  // Freeプランのみ表示（トライアル開始後やactive移行後は表示しない）
  const showTrialMailButton = !trialMailSentAt && plan === "free";
  const trialMailButtonText = "この設定で今すぐメールを受け取る";

  const sendTrialMail = async () => {
    if (!user) return;
    setTrialSending(true);
    setTrialMsg(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/send-trial", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.ok) {
        setTrialMsg({ text: "メールを送信しました。受信トレイを確認してください。", type: "success" });
        setTrialMailSentAt(new Date());
      } else if (json.error === "already_sent") {
        setTrialMsg({ text: "お試しメールは既に送信済みです。", type: "error" });
        setTrialMailSentAt(new Date());
      } else if (json.error === "already_delivered_today") {
        setTrialMsg({ text: "本日のメールは既に配信済みです。", type: "error" });
      } else {
        setTrialMsg({ text: "送信に失敗しました。しばらくしてからお試しください。", type: "error" });
      }
    } catch {
      setTrialMsg({ text: "送信に失敗しました。しばらくしてからお試しください。", type: "error" });
    } finally {
      setTrialSending(false);
    }
  };

  if (loadingAuth || loadingData) {
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

          {/* Already read banner */}
          {alreadyReadBanner && (
            <div style={{
              background: "#1d1f42", color: "#fff", padding: "14px 20px", borderRadius: 12,
              fontSize: 14, fontWeight: 600, textAlign: "center",
              animation: "fadeInOut 4s ease-in-out forwards",
            }}>
              この文書は既に読了しています
              <style>{`@keyframes fadeInOut { 0% { opacity: 0; } 10% { opacity: 1; } 75% { opacity: 1; } 100% { opacity: 0; } }`}</style>
            </div>
          )}

          {/* Page title */}
          <div>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 4 }}>設定</h1>
            <p style={{ fontSize: 14, color: "#6B7280" }}>{nickname || user?.email || ""}様</p>
          </div>

          {/* Billing */}
          <div className="app-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                <p style={{ fontSize: 12, color: "#6B7280" }}>現在のプラン</p>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 800 }}>
                  {plan === "standard" ? "Standard" : "Free"}
                  <span style={{ fontSize: 14, fontWeight: 400, color: "#6B7280", marginLeft: 8 }}>
                    {plan === "standard" ? "（月額500円）" : "（無料、メール受け取り不可）"}
                  </span>
                </p>
                {canRestartTrial && (
                  <p style={{ fontSize: 13, color: "#059669", marginTop: 4 }}>
                    トライアル期間内のため、無料で再開できます
                  </p>
                )}
                {plan === "standard" && currentPeriodEnd && (
                  <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                    次回更新: {formatTs(currentPeriodEnd)}
                    {cancelAtPeriodEnd && "（解約予約中）"}
                  </p>
                )}
              </div>
              <div>
                {plan === "standard" ? (
                  <button onClick={openPortal} disabled={billingLoading} className="app-btn-secondary">
                    {billingLoading ? "起動中..." : "プランを管理"}
                  </button>
                ) : (
                  <button onClick={goCheckout} disabled={billingLoading} className="app-btn-primary">
                    {billingLoading ? "処理中..." : showFreeTrialLabel ? "7日間無料で試す" : canRestartTrial ? "無料で再開する" : "アップグレード"}
                  </button>
                )}
              </div>
            </div>
            {billingError && <div className="app-error" style={{ marginTop: 16 }}>{billingError}</div>}
          </div>

          {/* Delivery Settings */}
          <div className="app-card">
            <h2 className="section-title">配信設定</h2>

            {/* Delivery email */}
            <div style={{ marginBottom: 20 }}>
              <label className="form-label">配信先メールアドレス</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  className="app-input"
                  type="email"
                  value={deliveryEmail}
                  onChange={(e) => {
                    setDeliveryEmail(e.target.value);
                    setDeliveryEmailVerified(false);
                    setDeliveryEmailMsg(null);
                  }}
                  style={{
                    flex: 1,
                    color: isCustomEmail && !deliveryEmailVerified ? "#9CA3AF" : "#1d1f42",
                    fontWeight: isCustomEmail && !deliveryEmailVerified ? 400 : 700,
                  }}
                />
                {isCustomEmail && !deliveryEmailVerified && (
                  <button
                    onClick={sendDeliveryVerification}
                    disabled={deliveryEmailSending}
                    className="app-btn-primary"
                    style={{ padding: "10px 20px", fontSize: 13, whiteSpace: "nowrap" }}
                  >
                    {deliveryEmailSending ? "送信中..." : "認証"}
                  </button>
                )}
                {deliveryEmailVerified && (
                  <span style={{ fontSize: 13, color: "#059669", fontWeight: 600, whiteSpace: "nowrap" }}>認証済み</span>
                )}
              </div>
              {isCustomEmail && !deliveryEmailVerified && (
                <p className="form-helper">認証ボタンを押すと、入力したアドレスに認証メールを送信します</p>
              )}
              {deliveryEmailMsg && (
                <p style={{ fontSize: 13, marginTop: 6, color: deliveryEmailMsg.includes("失敗") ? "#991B1B" : "#059669" }}>
                  {deliveryEmailMsg}
                </p>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label className="form-label">試験</label>
                <select
                  className="app-select"
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
              </div>

              <div>
                <label className="form-label">配信時間（JST）</label>
                <select className="app-select" value={sendTime} onChange={(e) => setSendTime(e.target.value)}>
                  {Array.from({ length: 144 }, (_, i) => {
                    const h = String(Math.floor(i / 6)).padStart(2, "0");
                    const m = String((i % 6) * 10).padStart(2, "0");
                    return <option key={`${h}:${m}`} value={`${h}:${m}`}>{h}:{m}</option>;
                  })}
                </select>
              </div>

              <div>
                <label className="form-label">レベル</label>
                <select className="app-select" value={examLevel} onChange={(e) => setExamLevel(e.target.value)}>
                  {levelOptionsByExam[examType].map((lv) => (
                    <option key={lv} value={lv}>{lv}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">単語数（words）</label>
                <select className="app-select" value={wordCount} onChange={(e) => setWordCount(Number(e.target.value))}>
                  {[50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <p className="form-helper">100〜200がおすすめ</p>
              </div>
            </div>

            <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={onSave} disabled={saving} className="app-btn-primary">
                {saving ? "保存中..." : "保存"}
              </button>
              {message && <div className={messageType === "success" ? "app-success" : "app-error"} style={{ padding: "8px 16px" }}>{message}</div>}
            </div>
          </div>

          {/* Trial mail button */}
          {showTrialMailButton && (
            <div>
              <button
                onClick={sendTrialMail}
                disabled={trialSending}
                className="app-btn-primary"
                style={{
                  width: "100%",
                  padding: "16px 24px",
                  fontSize: 15,
                  fontWeight: 700,
                  borderRadius: 12,
                  opacity: trialSending ? 0.6 : 1,
                }}
              >
                {trialSending ? "送信中..." : trialMailButtonText}
              </button>
              {trialMsg && (
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 13,
                    color: trialMsg.type === "success" ? "#059669" : "#991B1B",
                    textAlign: "center",
                  }}
                >
                  {trialMsg.text}
                </div>
              )}
            </div>
          )}

          {/* Account management link */}
          <div style={{ textAlign: "center", paddingTop: 8 }}>
            <a href="/account" className="app-btn-secondary" style={{ padding: "12px 32px", fontSize: 14 }}>
              アカウント管理
            </a>
          </div>

        </div>
      </main>
    </div>
  );
}
