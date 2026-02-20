"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, deleteField } from "firebase/firestore";
import { auth, db } from "../../src/lib/firebase";
import { useRouter } from "next/navigation";
import "../app.css";
import AppHeader from "../components/AppHeader";

type Plan = "free" | "standard";

type UserSettings = {
  email: string;
  level: number;
  wordCount: number;
  sendTime: string;
  updatedAt?: any;
  createdAt?: any;
  plan?: Plan;
  subscriptionStatus?: string | null;
};

const DEFAULT_SETTINGS: Omit<UserSettings, "email"> = {
  level: 2,
  wordCount: 100,
  sendTime: "08:00",
};

const LEVELS = [
  { value: 1, name: "Fundamental", tagline: "英語の「核」を捉え、読む自信を積み上げる", ref: "英検3級 / TOEIC ~300" },
  { value: 2, name: "Daily Connect", tagline: "「定型文」を卒業し、状況に応じた文脈を掴む", ref: "英検準2級 / TOEIC 400~" },
  { value: 3, name: "Business Lite", tagline: "「明日誰かに話したくなる」知的な刺激を、負担なく摂取する", ref: "英検2級 / TOEIC 600~" },
  { value: 4, name: "Global Pulse", tagline: "英語を「勉強」するのではなく、英語「で」世界を知る", ref: "英検準1級 / TOEIC 800~" },
  { value: 5, name: "Executive", tagline: "英語の壁を忘れ、書き手の思想や深い洞察に没頭する", ref: "英検1級 / TOEIC 900~" },
];

function legacyExamToLevel(examType: string, examLevel: string): number {
  const map: Record<string, number> = {
    "TOEIC TOEIC 400": 2, "TOEIC TOEIC 500": 2,
    "TOEIC TOEIC 600": 3, "TOEIC TOEIC 700": 3,
    "TOEIC TOEIC 800": 4, "TOEIC TOEIC 900": 5, "TOEIC TOEIC 990": 5,
    "EIKEN 英検 3級": 1, "EIKEN 英検 準2級プラス": 2, "EIKEN 英検 準2級": 2,
    "EIKEN 英検 2級": 3, "EIKEN 英検 準1級": 4, "EIKEN 英検 1級": 5,
    "TOEFL TOEFL 30~44": 1, "TOEFL TOEFL 45~62": 2, "TOEFL TOEFL 63~93": 3,
    "TOEFL TOEFL 94~108": 4, "TOEFL TOEFL 109~115": 5, "TOEFL TOEFL 116~120": 5,
  };
  return map[`${examType} ${examLevel}`] ?? 2;
}

function safeNumber(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}


export default function SettingsPage() {
  const router = useRouter();

  // already_read バナー
  const [alreadyReadBanner, setAlreadyReadBanner] = useState(false);
  // billing=success バナー（トライアル申込完了後の遷移）
  const [billingBanner, setBillingBanner] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("already_read") === "1") {
        setAlreadyReadBanner(true);
        const t = setTimeout(() => setAlreadyReadBanner(false), 4000);
        return () => clearTimeout(t);
      }
      if (params.get("billing") === "success") {
        setBillingBanner("__billing_success__");
        const t = setTimeout(() => setBillingBanner(null), 6000);
        return () => clearTimeout(t);
      }
    }
  }, []);

  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [deliverySaveMsg, setDeliverySaveMsg] = useState<{text: string; type: "success"|"error"} | null>(null);
  const [savingDifficulty, setSavingDifficulty] = useState(false);
  const [difficultySaveMsg, setDifficultySaveMsg] = useState<{text: string; type: "success"|"error"} | null>(null);

  const [nickname, setNickname] = useState("");

  const [level, setLevel] = useState(DEFAULT_SETTINGS.level);
  const [wordCount, setWordCount] = useState(DEFAULT_SETTINGS.wordCount);
  const [sendTime, setSendTime] = useState(DEFAULT_SETTINGS.sendTime);

  // Track saved values to detect unsaved changes
  const [savedLevel, setSavedLevel] = useState(DEFAULT_SETTINGS.level);
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
  const [trialUsed, setTrialUsed] = useState<boolean>(false);
  const [trialEndsAt, setTrialEndsAt] = useState<any>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<any>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [resumeConsentChecked, setResumeConsentChecked] = useState(false);

  // Trial mail
  const [trialMailSentAt, setTrialMailSentAt] = useState<any>(null);
  const [firstDeliveryAt, setFirstDeliveryAt] = useState<any>(null);
  const [standardStartedAt, setStandardStartedAt] = useState<any>(null);
  const [trialSending, setTrialSending] = useState(false);
  const [trialMsg, setTrialMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Delivery days (0=月, 6=日)
  const defaultDays = [true, true, true, true, true, true, true];
  const [deliveryDays, setDeliveryDays] = useState<boolean[]>(defaultDays);
  const [savedDeliveryDays, setSavedDeliveryDays] = useState<boolean[]>(defaultDays);

  // Legacy pause migration
  const [legacyPaused, setLegacyPaused] = useState(false);
  const [legacyPausedAt, setLegacyPausedAt] = useState<string | null>(null);

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
      const data = snap.data() as Partial<UserSettings> & { nickname?: string; examType?: string; examLevel?: string };
      setNickname(data.nickname ?? "");
      const loadedLevel = typeof (data as any).level === "number"
        ? (data as any).level
        : (data as any).examType
          ? legacyExamToLevel((data as any).examType, (data as any).examLevel ?? "")
          : DEFAULT_SETTINGS.level;
      const loadedWordCount = typeof data.wordCount === "number" ? data.wordCount : safeNumber(data.wordCount, DEFAULT_SETTINGS.wordCount);
      const loadedSendTime = data.sendTime ?? DEFAULT_SETTINGS.sendTime;
      setLevel(loadedLevel);
      setWordCount(loadedWordCount);
      setSendTime(loadedSendTime);
      setSavedLevel(loadedLevel);
      setSavedWordCount(loadedWordCount);
      setSavedSendTime(loadedSendTime);
      // Firestoreに未設定の場合、デフォルト値を補完書き込み
      const missing: Record<string, any> = {};
      if (!data.sendTime) missing.sendTime = DEFAULT_SETTINGS.sendTime;
      if ((data as any).level == null) missing.level = loadedLevel;
      if (data.wordCount == null) missing.wordCount = DEFAULT_SETTINGS.wordCount;
      if (Object.keys(missing).length > 0) {
        await setDoc(ref, { ...missing, updatedAt: serverTimestamp() }, { merge: true });
      }
      const loadedPlan = (data.plan as Plan) ?? "free";
      setPlan(loadedPlan);
      setSubscriptionStatus((data.subscriptionStatus as any) ?? null);
      setCancelAtPeriodEnd(Boolean((data as any).cancelAtPeriodEnd));
      setCurrentPeriodEnd((data as any).currentPeriodEnd ?? null);
      const localTrialUsed = Boolean((data as any).trialUsed);
      setTrialUsed(localTrialUsed);
      setTrialEndsAt((data as any).trialEndsAt ?? null);
      // 再登録ユーザー: trialEmails でメールハッシュを照合
      if (!localTrialUsed && u.email) {
        const idToken = await u.getIdToken();
        fetch("/api/check-trial", { headers: { Authorization: `Bearer ${idToken}` } })
          .then(r => r.json())
          .then(j => { if (j.trialUsed) setTrialUsed(true); })
          .catch(() => {});
      }
      // standard会員: Stripeの実状態と同期
      if (loadedPlan === "standard" && (data as any).stripeSubscriptionId) {
        try {
          const idToken = await u.getIdToken();
          const statusRes = await fetch("/api/stripe/status", { headers: { Authorization: `Bearer ${idToken}` } });
          const statusJson = await statusRes.json();
          if (statusJson.ok && statusJson.synced) {
            setCancelAtPeriodEnd(statusJson.cancelAtPeriodEnd);
            setSubscriptionStatus(statusJson.subscriptionStatus);
            if (statusJson.currentPeriodEnd) setCurrentPeriodEnd(statusJson.currentPeriodEnd);
          }
        } catch {}
      }
      const loadedDeliveryEmail = (data as any).deliveryEmail ?? u.email ?? "";
      setDeliveryEmail(loadedDeliveryEmail);
      setSavedDeliveryEmail(loadedDeliveryEmail);
      setDeliveryEmailVerified(Boolean((data as any).deliveryEmailVerified));
      setTrialMailSentAt((data as any).trialMailSentAt ?? null);
      setFirstDeliveryAt((data as any).firstDeliveryAt ?? null);
      setStandardStartedAt((data as any).standardStartedAt ?? null);
      // deliveryDays
      const rawDays: number[] = Array.isArray((data as any).deliveryDays) ? (data as any).deliveryDays : [0,1,2,3,4,5,6];
      const loadedDays = [0,1,2,3,4,5,6].map(i => rawDays.includes(i));
      setDeliveryDays(loadedDays);
      setSavedDeliveryDays(loadedDays);
      // Legacy pause
      setLegacyPaused(Boolean((data as any).deliveryPaused));
      setLegacyPausedAt((data as any).pausedAt ?? null);
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
  }, [user]);

  const onSaveDelivery = async () => {
    if (!user) return;
    setSavingDelivery(true);
    setDeliverySaveMsg(null);
    try {
      const ref = doc(db, "users", user.uid);
      const daysArray = deliveryDays.map((on, i) => on ? i : -1).filter(i => i >= 0);
      const updateData: Record<string, any> = {
        sendTime,
        deliveryDays: daysArray,
        updatedAt: serverTimestamp(),
      };
      if (legacyPaused) {
        updateData.deliveryPaused = false;
        updateData.pausedAt = deleteField();
        setLegacyPaused(false);
        setLegacyPausedAt(null);
      }
      await setDoc(ref, updateData, { merge: true });
      setSavedSendTime(sendTime);
      setSavedDeliveryDays([...deliveryDays]);
      setDeliverySaveMsg({ text: "保存しました", type: "success" });
      setTimeout(() => setDeliverySaveMsg(null), 3000);
    } catch (e: any) {
      console.error("[saveDelivery]", e);
      setDeliverySaveMsg({ text: `保存に失敗しました（${e?.code || e?.message || "unknown"}）`, type: "error" });
    } finally {
      setSavingDelivery(false);
    }
  };

  const onSaveDifficulty = async () => {
    if (!user) return;
    setSavingDifficulty(true);
    setDifficultySaveMsg(null);
    try {
      const ref = doc(db, "users", user.uid);
      await setDoc(ref, {
        level, wordCount,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSavedLevel(level);
      setSavedWordCount(wordCount);
      setDifficultySaveMsg({ text: "保存しました", type: "success" });
      setTimeout(() => setDifficultySaveMsg(null), 3000);
    } catch (e: any) {
      console.error("[saveDifficulty]", e);
      setDifficultySaveMsg({ text: `保存に失敗しました（${e?.code || e?.message || "unknown"}）`, type: "error" });
    } finally {
      setSavingDifficulty(false);
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

  // Billing logic
  const showFreeTrialLabel = plan === "free" && trialUsed === false;
  const canRestartTrial = plan === "free" && trialUsed === true && (() => {
    if (!trialEndsAt) return false;
    const end = typeof trialEndsAt?.toDate === "function" ? trialEndsAt.toDate() : new Date(trialEndsAt);
    return end.getTime() > Date.now();
  })();

  const goCheckout = async () => {
    if (!user) return;
    setBillingLoading(true);
    setBillingError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          trialDays: 7,
          successPath: "/routine?billing=success",
          cancelPath: "/billing?billing=cancel",
          consent: {
            agreedAt: new Date().toISOString(),
            termsVersion: "2026-02-20",
            privacyVersion: "2026-02-20",
            displayedTerms: [
              "月額500円（税込）",
              showFreeTrialLabel ? "初回7日間無料" : null,
              showFreeTrialLabel ? "無料期間終了後、自動的に有料プランへ移行" : null,
              "解約しない限り毎月自動更新",
              "更新日の前日までに解約可能",
              "決済完了後の返金・日割り計算不可",
            ].filter(Boolean),
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (json?.code === "subscription_exists") {
        const token2 = await user.getIdToken();
        const res2 = await fetch("/api/stripe/portal", {
          method: "POST",
          headers: { Authorization: `Bearer ${token2}`, "Content-Type": "application/json" },
          body: JSON.stringify({ returnPath: "/billing" }),
        });
        const json2 = await res2.json();
        if (res2.ok && json2?.ok && json2?.url) window.location.href = json2.url;
        return;
      }
      if (!res.ok || !json?.ok || !json?.url) { setBillingError("課金処理に失敗しました。"); return; }
      window.location.href = json.url;
    } catch {
      setBillingError("課金処理に失敗しました。");
    } finally {
      setBillingLoading(false);
    }
  };

  const openPortal = async (withConsent = false) => {
    if (!user) return;
    setBillingLoading(true);
    setBillingError(null);
    try {
      const token = await user.getIdToken();
      const bodyData: any = { returnPath: "/routine" };
      if (withConsent) {
        bodyData.consent = {
          agreedAt: new Date().toISOString(),
          termsVersion: "2026-02-20",
          privacyVersion: "2026-02-20",
          displayedTerms: [
            "月額500円（税込）",
            "解約しない限り毎月自動更新",
            "いつでも解約可能（解約後も次回更新日まで利用可能）",
            "決済完了後の返金不可",
          ],
        };
      }
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
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

  // Check for unsaved changes
  const daysChanged = deliveryDays.some((v, i) => v !== savedDeliveryDays[i]);
  const hasUnsavedDelivery = sendTime !== savedSendTime || daysChanged;
  const hasUnsavedDifficulty = level !== savedLevel || wordCount !== savedWordCount;
  const hasUnsavedChanges = hasUnsavedDelivery || hasUnsavedDifficulty;
  const [unsavedWarningMsg, setUnsavedWarningMsg] = useState(false);

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

          {billingBanner && (
            <div style={{
              background: "#1d1f42", color: "#fff", padding: "14px 20px", borderRadius: 12,
              fontSize: 14, fontWeight: 600, textAlign: "center",
              animation: "fadeInOut6 6s ease-in-out forwards",
            }}>
              {subscriptionStatus === "trialing"
                ? "トライアルの申し込みが完了しました！配信設定をカスタマイズしましょう。"
                : "Standardプランへの登録が完了しました！配信設定をカスタマイズしましょう。"}
              <style>{`@keyframes fadeInOut6 { 0% { opacity: 0; } 8% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }`}</style>
            </div>
          )}

          {/* Page title */}
          <div>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 4 }}>学習プラン</h1>
            <p style={{ fontSize: 14, color: "#6B7280" }}>{nickname || user?.email || ""}様</p>
          </div>

          {message && (
            <div className={messageType === "success" ? "app-success" : "app-error"} style={{ padding: "8px 16px" }}>{message}</div>
          )}

          {/* Billing card for cancelled standard users */}
          {plan === "standard" && cancelAtPeriodEnd && (
            <div className="app-card">
              <div>
                <p style={{ fontSize: 12, color: "#6B7280" }}>現在のプラン</p>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 800 }}>
                  Standard
                  <span style={{ fontSize: 14, fontWeight: 400, color: "#6B7280", marginLeft: 8 }}>
                    （月額500円）
                  </span>
                </p>
                {currentPeriodEnd && (
                  <p style={{ fontSize: 14, color: "#DC2626", marginTop: 8, fontWeight: 600 }}>
                    サービスは {(() => {
                      try {
                        const d = typeof currentPeriodEnd?.toDate === "function" ? currentPeriodEnd.toDate() : currentPeriodEnd instanceof Date ? currentPeriodEnd : new Date(currentPeriodEnd);
                        if (Number.isNaN(d.getTime())) return "-";
                        return d.toLocaleDateString("ja-JP");
                      } catch { return "-"; }
                    })()} に終了します
                  </p>
                )}
              </div>

              <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #E8EAED" }}>
                <div style={{
                  background: "#F9FAFB",
                  borderRadius: 10,
                  padding: "16px 20px",
                  marginBottom: 16,
                  fontSize: 13,
                  color: "#374151",
                  lineHeight: 1.8
                }}>
                  <p style={{ fontWeight: 600, marginBottom: 8 }}>月額500円（税込）</p>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li>解約しない限り毎月自動更新されます</li>
                    <li>いつでも解約可能です（解約後も次回更新日まで利用できます）</li>
                    <li>決済完了後の返金には応じておりません</li>
                  </ul>
                </div>

                <label style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  cursor: "pointer",
                  marginBottom: 16,
                  fontSize: 13,
                  color: "#374151"
                }}>
                  <input
                    type="checkbox"
                    checked={resumeConsentChecked}
                    onChange={(e) => setResumeConsentChecked(e.target.checked)}
                    style={{ marginTop: 2, width: 16, height: 16, accentColor: "var(--primary-cyan)" }}
                  />
                  <span>
                    上記内容および
                    <a href="/terms" target="_blank" style={{ color: "#1d1f42", textDecoration: "underline" }}>利用規約</a>
                    ・
                    <a href="/privacy" target="_blank" style={{ color: "#1d1f42", textDecoration: "underline" }}>プライバシーポリシー</a>
                    ・
                    <a href="/legal/tokushoho" target="_blank" style={{ color: "#1d1f42", textDecoration: "underline" }}>特定商取引法に基づく表記</a>
                    に同意します
                  </span>
                </label>

                <button
                  onClick={() => openPortal(true)}
                  disabled={billingLoading || !resumeConsentChecked}
                  className="app-btn-primary"
                  style={{
                    width: "100%",
                    padding: "14px 24px",
                    fontSize: 15,
                    opacity: resumeConsentChecked ? 1 : 0.5
                  }}
                >
                  {billingLoading ? "処理中..." : "再開"}
                </button>
              </div>

              {billingError && <div className="app-error" style={{ marginTop: 16 }}>{billingError}</div>}
            </div>
          )}

          {/* Billing card for free users */}
          {plan !== "standard" && (
            <div className="app-card">
              <div>
                <p style={{ fontSize: 12, color: "#6B7280" }}>現在のプラン</p>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 800 }}>
                  Free
                  <span style={{ fontSize: 14, fontWeight: 400, color: "#6B7280", marginLeft: 8 }}>
                    （無料、メール受け取り不可）
                  </span>
                </p>
                {canRestartTrial && (
                  <p style={{ fontSize: 13, color: "#059669", marginTop: 4 }}>
                    トライアル期間内のため、無料で再開できます
                  </p>
                )}
              </div>

              <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #E8EAED" }}>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
                  Standardプランにアップグレード
                </p>

                <div style={{
                  background: "#F9FAFB",
                  borderRadius: 10,
                  padding: "16px 20px",
                  marginBottom: 16,
                  fontSize: 13,
                  color: "#374151",
                  lineHeight: 1.8
                }}>
                  <p style={{ fontWeight: 600, marginBottom: 8 }}>月額500円（税込）{showFreeTrialLabel && " / 初回7日間無料"}</p>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {showFreeTrialLabel && <li>無料期間終了後に自動的に課金が開始されます</li>}
                    {showFreeTrialLabel && <li>無料期間中に解約すれば料金は発生しません</li>}
                    <li>解約しない限り毎月自動更新されます</li>
                    <li>いつでも解約可能です（解約後も次回更新日まで利用できます）</li>
                    <li>決済完了後の返金には応じておりません</li>
                  </ul>
                </div>

                <label style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  cursor: "pointer",
                  marginBottom: 16,
                  fontSize: 13,
                  color: "#374151"
                }}>
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    style={{ marginTop: 2, width: 16, height: 16, accentColor: "var(--primary-cyan)" }}
                  />
                  <span>
                    上記内容および
                    <a href="/terms" target="_blank" style={{ color: "#1d1f42", textDecoration: "underline" }}>利用規約</a>
                    ・
                    <a href="/privacy" target="_blank" style={{ color: "#1d1f42", textDecoration: "underline" }}>プライバシーポリシー</a>
                    ・
                    <a href="/legal/tokushoho" target="_blank" style={{ color: "#1d1f42", textDecoration: "underline" }}>特定商取引法に基づく表記</a>
                    に同意します
                  </span>
                </label>

                <button
                  onClick={goCheckout}
                  disabled={billingLoading || !consentChecked}
                  className="app-btn-primary"
                  style={{
                    width: "100%",
                    padding: "14px 24px",
                    fontSize: 15,
                    opacity: consentChecked ? 1 : 0.5
                  }}
                >
                  {billingLoading ? "処理中..." : showFreeTrialLabel ? "7日間無料で試す" : canRestartTrial ? "無料で再開する" : "Standardプランにアップグレード"}
                </button>
              </div>

              {billingError && <div className="app-error" style={{ marginTop: 16 }}>{billingError}</div>}
            </div>
          )}

          {/* 配信設定 */}
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

            {/* 配信曜日 */}
            <div style={{ marginTop: 20 }}>
              <label className="form-label">配信曜日</label>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                {["月", "火", "水", "木", "金", "土", "日"].map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setDeliveryDays(prev => { const next = [...prev]; next[i] = !next[i]; return next; })}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: "'Inter', sans-serif",
                      background: deliveryDays[i] ? "#1d1f42" : "#E5E7EB",
                      color: deliveryDays[i] ? "#fff" : "#9CA3AF",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="form-helper">※ OFFの曜日はメールが届かず、達成率の計算からも除外されます</p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
              <button onClick={onSaveDelivery} disabled={savingDelivery || !hasUnsavedDelivery} className="app-btn-primary">
                {savingDelivery ? "保存中..." : "保存"}
              </button>
              {deliverySaveMsg && <span style={{ fontSize: 13, color: deliverySaveMsg.type === "success" ? "#059669" : "#991B1B", fontWeight: 600 }}>{deliverySaveMsg.text}</span>}
            </div>
          </div>

          {/* 難易度設定 */}
          <div className="app-card">
            <h2 className="section-title">難易度設定</h2>

            <div style={{ marginBottom: 20 }}>
              <label className="form-label">レベル</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                {LEVELS.map((lv) => (
                  <button
                    key={lv.value}
                    type="button"
                    onClick={() => setLevel(lv.value)}
                    style={{
                      display: "flex", flexDirection: "column", gap: 2,
                      width: "100%", padding: "12px 16px",
                      border: level === lv.value ? "2px solid #1d1f42" : "2px solid #E5E7EB",
                      borderRadius: 10,
                      background: level === lv.value ? "#F5F7FA" : "#fff",
                      cursor: "pointer", textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: level === lv.value ? "#1d1f42" : "#374151" }}>
                      Level {lv.value} : {lv.name}
                    </span>
                    <span style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>{lv.tagline}</span>
                  </button>
                ))}
              </div>
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

            <p style={{ marginTop: 16, fontSize: 13, color: "#1d1f42", lineHeight: 1.7, fontWeight: 600 }}>
              英文のテーマはビジネス関連のトピックからランダムに選出されます。<br />
              同じようなテーマが連続で届く場合もありますので、あらかじめご了承ください。
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
              <button onClick={onSaveDifficulty} disabled={savingDifficulty || !hasUnsavedDifficulty} className="app-btn-primary">
                {savingDifficulty ? "保存中..." : "保存"}
              </button>
              {difficultySaveMsg && <span style={{ fontSize: 13, color: difficultySaveMsg.type === "success" ? "#059669" : "#991B1B", fontWeight: 600 }}>{difficultySaveMsg.text}</span>}
            </div>
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


        </div>
      </main>
    </div>
  );
}
