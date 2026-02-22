"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../src/lib/firebase";
import { useRouter } from "next/navigation";
import "../app.css";
import AppHeader from "../components/AppHeader";

type Plan = "free" | "standard";

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

function formatDateOnly(ts: any, withTime = false) {
  try {
    if (!ts) return null;
    const d =
      typeof ts?.toDate === "function" ? ts.toDate() : ts instanceof Date ? ts : new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    if (withTime) {
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      return `${d.toLocaleDateString("ja-JP")} ${h}:${m}`;
    }
    return d.toLocaleDateString("ja-JP");
  } catch {
    return null;
  }
}

export default function BillingPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingData, setLoadingData] = useState(true);

  const [plan, setPlan] = useState<Plan>("free");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [trialUsed, setTrialUsed] = useState<boolean>(false);
  const [trialEndsAt, setTrialEndsAt] = useState<any>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<any>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState<boolean>(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [resumeConsentChecked, setResumeConsentChecked] = useState(false);

  // billing=success banner
  const [billingBanner, setBillingBanner] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("billing") === "success") {
        setBillingBanner("プランの変更が完了しました");
        const t = setTimeout(() => setBillingBanner(null), 4000);
        return () => clearTimeout(t);
      }
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingAuth(false);
      if (!u) { router.replace("/login"); return; }
      if (!u.emailVerified) { router.replace("/verify-email"); return; }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      setLoadingData(true);
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as any;
          setPlan((data.plan as Plan) ?? "free");
          setSubscriptionStatus(data.subscriptionStatus ?? null);
          const localTrialUsed = Boolean(data.trialUsed);
          setTrialUsed(localTrialUsed);
          setTrialEndsAt(data.trialEndsAt ?? null);
          // 再登録ユーザー: trialEmails でメールハッシュを照合
          if (!localTrialUsed && user.email) {
            const idToken = await user.getIdToken();
            fetch("/api/check-trial", { headers: { Authorization: `Bearer ${idToken}` } })
              .then(r => r.json())
              .then(j => { if (j.trialUsed) setTrialUsed(true); })
              .catch(() => {});
          }
          setCurrentPeriodEnd(data.currentPeriodEnd ?? null);
          setCancelAtPeriodEnd(Boolean(data.cancelAtPeriodEnd));

          // standard会員: Stripeの実状態と同期（完了を待つ）
          if ((data.plan as Plan) === "standard" && (data.stripeSubscriptionId || data.stripeCustomerId)) {
            try {
              const idToken = await user.getIdToken();
              const statusRes = await fetch("/api/stripe/status", { headers: { Authorization: `Bearer ${idToken}` } });
              const statusJson = await statusRes.json();
              if (statusJson.ok && statusJson.synced) {
                setCancelAtPeriodEnd(statusJson.cancelAtPeriodEnd);
                setSubscriptionStatus(statusJson.subscriptionStatus);
                if (statusJson.currentPeriodEnd) setCurrentPeriodEnd(statusJson.currentPeriodEnd);
              }
            } catch {}
          }
        }
      } catch (e) {
        console.error(e);
      }
      setLoadingData(false);
    };
    run();
  }, [user]);

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
      if (json?.code === "subscription_exists") { await openPortalInternal("/billing"); return; }
      if (!res.ok || !json?.ok || !json?.url) { setBillingError("課金処理に失敗しました。"); return; }
      window.location.href = json.url;
    } catch {
      setBillingError("課金処理に失敗しました。");
    } finally {
      setBillingLoading(false);
    }
  };

  const cancelTrial = async () => {
    if (!user) return;
    if (!window.confirm("トライアルを解約しますか？\n解約すると即時にサービスが停止します。")) return;
    setBillingLoading(true);
    setBillingError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/stripe/cancel", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) { setBillingError("解約処理に失敗しました。"); return; }
      setPlan("free");
      setSubscriptionStatus("canceled");
      setCancelAtPeriodEnd(false);
    } catch {
      setBillingError("解約処理に失敗しました。");
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
      const bodyData: any = { returnPath: "/billing" };
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

  const openPortalInternal = async (returnPath = "/billing") => {
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

          {billingBanner && (
            <div style={{
              background: "#059669", color: "#fff", padding: "14px 20px", borderRadius: 12,
              fontSize: 14, fontWeight: 600, textAlign: "center",
              animation: "fadeInOut 4s ease-in-out forwards",
            }}>
              {billingBanner}
              <style>{`@keyframes fadeInOut { 0% { opacity: 0; } 10% { opacity: 1; } 75% { opacity: 1; } 100% { opacity: 0; } }`}</style>
            </div>
          )}

          <div>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 4 }}>プランの確認・解約</h1>
          </div>

          <div className="app-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                <p style={{ fontSize: 12, color: "#6B7280" }}>現在のプラン</p>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 800 }}>
                  {plan === "standard" ? "Standard" : "Free"}
                  <span style={{ fontSize: 14, fontWeight: 400, color: "#6B7280", marginLeft: 8 }}>
                    {subscriptionStatus === "trialing" ? "（トライアル中）" : plan === "standard" ? "（月額500円）" : "（無料、メール受け取り不可）"}
                  </span>
                </p>
                {subscriptionStatus === "trialing" && trialEndsAt && (
                  <p style={{ fontSize: 12, color: "#92400E", marginTop: 4 }}>
                    ※トライアルは{(() => {
                      try {
                        const d = typeof trialEndsAt?.toDate === "function" ? trialEndsAt.toDate() : trialEndsAt instanceof Date ? trialEndsAt : new Date(trialEndsAt);
                        if (Number.isNaN(d.getTime())) return "";
                        return d.toLocaleDateString("ja-JP") + " " + d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
                      } catch { return ""; }
                    })()}に終了します
                  </p>
                )}
                {canRestartTrial && (
                  <p style={{ fontSize: 13, color: "#059669", marginTop: 4 }}>
                    トライアル期間内のため、無料で再開できます
                  </p>
                )}
                {plan === "standard" && cancelAtPeriodEnd && currentPeriodEnd && (
                  <p style={{ fontSize: 14, color: "#DC2626", marginTop: 8, fontWeight: 600 }}>
                    サービスは {formatDateOnly(currentPeriodEnd, true)} に終了します。
                  </p>
                )}
                {plan === "standard" && !cancelAtPeriodEnd && currentPeriodEnd && (
                  <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                    次回更新: {formatTs(currentPeriodEnd)}
                  </p>
                )}
              </div>
              <div>
                {plan === "standard" && !cancelAtPeriodEnd && (
                  <button
                    onClick={subscriptionStatus === "trialing" ? cancelTrial : () => openPortal()}
                    disabled={billingLoading}
                    className="app-btn-secondary"
                  >
                    {billingLoading ? "処理中..." : "解約"}
                  </button>
                )}
              </div>
            </div>

            {/* Resume section for cancelled standard users */}
            {plan === "standard" && cancelAtPeriodEnd && (
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
            )}

            {/* Upgrade section for free users */}
            {plan !== "standard" && (
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
            )}

            {billingError && <div className="app-error" style={{ marginTop: 16 }}>{billingError}</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
