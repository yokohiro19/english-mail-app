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
};

const DEFAULT_SETTINGS: Omit<UserSettings, "email"> = {
  examType: "TOEIC",
  examLevel: "TOEIC 600",
  wordCount: 100,
  sendTime: "08:00",
};

function safeNumber(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
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

  // Track saved values to detect unsaved changes
  const [savedExamType, setSavedExamType] = useState<ExamType>(DEFAULT_SETTINGS.examType);
  const [savedExamLevel, setSavedExamLevel] = useState(DEFAULT_SETTINGS.examLevel);
  const [savedWordCount, setSavedWordCount] = useState(DEFAULT_SETTINGS.wordCount);
  const [savedSendTime, setSavedSendTime] = useState(DEFAULT_SETTINGS.sendTime);

  // Delivery email
  const [deliveryEmail, setDeliveryEmail] = useState("");
  const [savedDeliveryEmail, setSavedDeliveryEmail] = useState("");
  const [deliveryEmailVerified, setDeliveryEmailVerified] = useState(false);
  const [deliveryEmailSending, setDeliveryEmailSending] = useState(false);
  const [deliveryEmailMsg, setDeliveryEmailMsg] = useState<string | null>(null);

  // Billing
  const [plan, setPlan] = useState<Plan>("free");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);

  // Trial mail
  const [trialMailSentAt, setTrialMailSentAt] = useState<any>(null);
  const [firstDeliveryAt, setFirstDeliveryAt] = useState<any>(null);
  const [standardStartedAt, setStandardStartedAt] = useState<any>(null);
  const [trialSending, setTrialSending] = useState(false);
  const [trialMsg, setTrialMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Delivery pause
  const [deliveryPaused, setDeliveryPaused] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [pauseMsg, setPauseMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

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
      if (!u.emailVerified) { router.replace("/verify-email"); return; }
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
      const loadedExamLevel = data.examLevel ?? defaultLevelByExam[loadedExamType] ?? DEFAULT_SETTINGS.examLevel;
      const loadedWordCount = typeof data.wordCount === "number" ? data.wordCount : safeNumber(data.wordCount, DEFAULT_SETTINGS.wordCount);
      const loadedSendTime = data.sendTime ?? DEFAULT_SETTINGS.sendTime;
      setExamType(loadedExamType);
      setExamLevel(loadedExamLevel);
      setWordCount(loadedWordCount);
      setSendTime(loadedSendTime);
      setSavedExamType(loadedExamType);
      setSavedExamLevel(loadedExamLevel);
      setSavedWordCount(loadedWordCount);
      setSavedSendTime(loadedSendTime);
      // sendTime等がFirestoreに未設定の場合、デフォルト値を補完書き込み
      const missing: Record<string, any> = {};
      if (!data.sendTime) missing.sendTime = DEFAULT_SETTINGS.sendTime;
      if (!data.examType) missing.examType = DEFAULT_SETTINGS.examType;
      if (!data.examLevel) missing.examLevel = DEFAULT_SETTINGS.examLevel;
      if (data.wordCount == null) missing.wordCount = DEFAULT_SETTINGS.wordCount;
      if (Object.keys(missing).length > 0) {
        await setDoc(ref, { ...missing, updatedAt: serverTimestamp() }, { merge: true });
      }
      setPlan((data.plan as Plan) ?? "free");
      setSubscriptionStatus((data.subscriptionStatus as any) ?? null);
      const loadedDeliveryEmail = (data as any).deliveryEmail ?? u.email ?? "";
      setDeliveryEmail(loadedDeliveryEmail);
      setSavedDeliveryEmail(loadedDeliveryEmail);
      setDeliveryEmailVerified(Boolean((data as any).deliveryEmailVerified));
      setTrialMailSentAt((data as any).trialMailSentAt ?? null);
      setFirstDeliveryAt((data as any).firstDeliveryAt ?? null);
      setStandardStartedAt((data as any).standardStartedAt ?? null);
      setDeliveryPaused(Boolean((data as any).deliveryPaused));
    } else {
      // New user - use defaults
      setDeliveryEmail(u.email ?? "");
      setSavedDeliveryEmail(u.email ?? "");
      setDeliveryEmailVerified(false);
      // Create user doc with only client-writable fields (plan/trialUsed are server-only)
      await setDoc(ref, {
        email: u.email ?? "",
        ...DEFAULT_SETTINGS,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
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
      await setDoc(ref, {
        email: user.email ?? "",
        examType, examLevel, wordCount, sendTime,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSavedExamType(examType);
      setSavedExamLevel(examLevel);
      setSavedWordCount(wordCount);
      setSavedSendTime(sendTime);
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
      if (json.ok && json.autoVerified) {
        setDeliveryEmailMsg("ログインアドレスに戻しました。");
        setDeliveryEmailVerified(true);
        setSavedDeliveryEmail(deliveryEmail);
      } else if (json.ok) {
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

  // Trial mail button logic
  // 送信済み or 配信実績ありなら非表示
  const showTrialMailButton = !trialMailSentAt && !firstDeliveryAt;
  const isTrialMailEnabled = plan === "standard" || subscriptionStatus === "trialing" || subscriptionStatus === "active";
  const trialMailButtonText = "この設定で、本日分のメールを今すぐ受け取る";
  const [trialDisabledMsg, setTrialDisabledMsg] = useState(false);

  // Check for unsaved changes
  const hasUnsavedChanges = examType !== savedExamType || examLevel !== savedExamLevel || wordCount !== savedWordCount || sendTime !== savedSendTime;
  const [unsavedWarningMsg, setUnsavedWarningMsg] = useState(false);

  const toggleDeliveryPause = async () => {
    if (!user) return;
    setPauseLoading(true);
    setPauseMsg(null);
    try {
      const token = await user.getIdToken();
      const newPaused = !deliveryPaused;
      const res = await fetch("/api/delivery-pause", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ paused: newPaused }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setPauseMsg({ text: "更新に失敗しました", type: "error" });
        return;
      }
      setDeliveryPaused(newPaused);
      setPauseMsg({ text: newPaused ? "配信を一時停止しました" : "配信を再開しました", type: "success" });
    } catch {
      setPauseMsg({ text: "更新に失敗しました", type: "error" });
    } finally {
      setPauseLoading(false);
    }
  };

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
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 4 }}>学習プラン</h1>
            <p style={{ fontSize: 14, color: "#6B7280" }}>{nickname || user?.email || ""}様</p>
          </div>

          {/* Delivery pause toggle - only for active subscribers */}
          {plan === "standard" && (subscriptionStatus === "active" || subscriptionStatus === "trialing") && (
            <div className="app-card">
              <h2 className="section-title">配信設定</h2>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{
                    display: "inline-block",
                    padding: "6px 14px",
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 600,
                    background: deliveryPaused ? "#FEF3C7" : "#D1FAE5",
                    color: deliveryPaused ? "#92400E" : "#065F46",
                    whiteSpace: "nowrap",
                  }}>
                    {deliveryPaused ? "⏸ 一時停止中" : "✓ 配信中"}
                  </span>
                  <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                    {deliveryPaused
                      ? "再開するまでメールは届きません。停止中は達成率の計算から除外されます。"
                      : "毎日指定した時間にメールが届きます"}
                  </p>
                </div>
                <button
                  onClick={toggleDeliveryPause}
                  disabled={pauseLoading}
                  className="app-btn-secondary"
                  style={{
                    padding: "8px 20px",
                    fontSize: 13,
                    whiteSpace: "nowrap",
                    background: deliveryPaused ? "var(--primary-cyan)" : "#E5E7EB",
                    color: deliveryPaused ? "var(--dark-navy)" : "#374151",
                    border: "none",
                  }}
                >
                  {pauseLoading ? "処理中..." : deliveryPaused ? "配信を再開" : "一時停止"}
                </button>
              </div>
              {pauseMsg && (
                <p style={{ marginTop: 8, fontSize: 13, color: pauseMsg.type === "success" ? "#059669" : "#991B1B" }}>
                  {pauseMsg.text}
                </p>
              )}
            </div>
          )}

          {/* Delivery Settings */}
          <div className="app-card">
            <h2 className="section-title">メール設定</h2>

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
                    color: !deliveryEmailVerified && deliveryEmail !== savedDeliveryEmail ? "#9CA3AF" : "#1d1f42",
                    fontWeight: !deliveryEmailVerified && deliveryEmail !== savedDeliveryEmail ? 400 : 700,
                  }}
                />
                {!deliveryEmailVerified && deliveryEmail !== savedDeliveryEmail && (
                  <button
                    onClick={sendDeliveryVerification}
                    disabled={deliveryEmailSending}
                    className="app-btn-primary"
                    style={{ padding: "10px 20px", fontSize: 13, whiteSpace: "nowrap" }}
                  >
                    {deliveryEmailSending ? "送信中..." : isCustomEmail ? "認証" : "戻す"}
                  </button>
                )}
                {deliveryEmailVerified && (
                  <span style={{ fontSize: 13, color: "#059669", fontWeight: 600, whiteSpace: "nowrap" }}>認証済み</span>
                )}
              </div>
              {!deliveryEmailVerified && deliveryEmail !== savedDeliveryEmail && isCustomEmail && (
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
                  {[50, 100, 150, 200, 250, 300, 350, 400, 450, 500].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <p className="form-helper">※ 手軽な継続には100〜200がおすすめ</p>
              </div>

              <div>
                <label className="form-label">配信時間（JST）</label>
                <select className="app-select" value={sendTime} onChange={(e) => setSendTime(e.target.value)}>
                  {Array.from({ length: 144 }, (_, i) => {
                    const totalMinutes = (4 * 60 + i * 10) % (24 * 60);
                    const h = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
                    const m = String(totalMinutes % 60).padStart(2, "0");
                    return <option key={`${h}:${m}`} value={`${h}:${m}`}>{h}:{m}</option>;
                  })}
                </select>
                <p className="form-helper">※ 朝4:00から翌日3:59を１日とします</p>
              </div>
            </div>

            <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={onSave} disabled={saving} className="app-btn-primary">
                {saving ? "保存中..." : "保存"}
              </button>
              {message && <div className={messageType === "success" ? "app-success" : "app-error"} style={{ padding: "8px 16px" }}>{message}</div>}
            </div>

            <p style={{ marginTop: 16, fontSize: 13, color: "#1d1f42", lineHeight: 1.7, fontWeight: 600 }}>
              英文のテーマはビジネス関連のトピックからランダムに選出されます。<br />
              同じようなテーマが連続で届く場合もありますので、あらかじめご了承ください。
            </p>
          </div>

          {/* Trial mail button */}
          {showTrialMailButton && (
            <div>
              <button
                onClick={() => {
                  if (!isTrialMailEnabled) {
                    setTrialDisabledMsg(true);
                    setTimeout(() => setTrialDisabledMsg(false), 3000);
                    return;
                  }
                  if (hasUnsavedChanges) {
                    setUnsavedWarningMsg(true);
                    setTimeout(() => setUnsavedWarningMsg(false), 3000);
                    return;
                  }
                  sendTrialMail();
                }}
                disabled={trialSending}
                className={isTrialMailEnabled ? "app-btn-primary" : "app-btn-secondary"}
                style={{
                  width: "100%",
                  padding: "16px 24px",
                  fontSize: 15,
                  fontWeight: 700,
                  borderRadius: 12,
                  opacity: trialSending ? 0.6 : isTrialMailEnabled ? 1 : 0.5,
                  background: isTrialMailEnabled ? undefined : "#9CA3AF",
                  color: isTrialMailEnabled ? undefined : "#fff",
                  cursor: isTrialMailEnabled ? "pointer" : "default",
                }}
              >
                {trialSending ? "送信中..." : <><span style={{ lineHeight: 1.2 }}>{trialMailButtonText}</span><br /><span style={{ fontSize: 12, fontWeight: 400, lineHeight: 1 }}>（初回の1回のみ）</span></>}
              </button>
              {trialDisabledMsg && (
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 13,
                    color: "#991B1B",
                    textAlign: "center",
                  }}
                >
                  この機能を使うには、プランをアップデートしてください
                </div>
              )}
              {unsavedWarningMsg && (
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 13,
                    color: "#92400E",
                    textAlign: "center",
                  }}
                >
                  設定に未保存の変更があります。先に「保存」ボタンを押してください。
                </div>
              )}
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
