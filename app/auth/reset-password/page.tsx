"use client";

import { useEffect, useState } from "react";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { auth } from "../../../src/lib/firebase";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import "../../app.css";
import AppHeader from "../../components/AppHeader";

function ResetPasswordContent() {
  const params = useSearchParams();
  const oobCode = params.get("oobCode") || "";

  const [status, setStatus] = useState<"verifying" | "form" | "success" | "error">("verifying");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!oobCode) {
      setStatus("error");
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        setEmail(email);
        setStatus("form");
      })
      .catch(() => setStatus("error"));
  }, [oobCode]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (password.length < 6) {
      setFormError("パスワードは6文字以上で入力してください。");
      return;
    }
    if (password !== confirm) {
      setFormError("パスワードが一致しません。");
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStatus("success");
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/expired-action-code" || code === "auth/invalid-action-code") {
        setFormError("リンクの有効期限が切れています。再度パスワード再設定をお試しください。");
      } else if (code === "auth/weak-password") {
        setFormError("パスワードは6文字以上で入力してください。");
      } else {
        setFormError("設定に失敗しました。しばらくしてから再度お試しください。");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-page">
      <AppHeader variant="auth" />
      <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 56px)", padding: 24 }}>
        <div className="auth-card" style={status !== "form" ? { textAlign: "center" } : {}}>

          {status === "verifying" && (
            <>
              <div className="loading-spinner" style={{ margin: "0 auto 16px" }} />
              <p style={{ fontSize: 14, color: "#6B7280" }}>リンクを確認しています…</p>
            </>
          )}

          {status === "error" && (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
              <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
                リンクが無効です
              </h1>
              <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 24, lineHeight: 1.7 }}>
                リンクの有効期限が切れているか、既に使用済みです。<br />
                再度パスワード再設定をお試しください。
              </p>
              <a
                href="/reset-password"
                className="app-btn-primary"
                style={{ display: "inline-block", padding: "14px 32px", fontSize: 15, textDecoration: "none" }}
              >
                再設定メールを再送する
              </a>
            </>
          )}

          {status === "form" && (
            <>
              <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
                新しいパスワードを設定
              </h1>
              <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 24, lineHeight: 1.7 }}>
                <strong style={{ color: "#1d1f42" }}>{email}</strong> の新しいパスワードを入力してください。
              </p>

              <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="form-label">新しいパスワード</label>
                  <input
                    className="app-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="6文字以上"
                  />
                </div>
                <div>
                  <label className="form-label">新しいパスワード（確認）</label>
                  <input
                    className="app-input"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    placeholder="もう一度入力してください"
                  />
                </div>

                {formError && <div className="app-error">{formError}</div>}

                <button
                  className="app-btn-primary"
                  type="submit"
                  disabled={loading}
                  style={{ width: "100%", padding: "12px 24px", fontSize: 16, marginTop: 8 }}
                >
                  {loading ? "設定中..." : "パスワードを変更する"}
                </button>
              </form>
            </>
          )}

          {status === "success" && (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
                パスワードを変更しました
              </h1>
              <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 24, lineHeight: 1.7 }}>
                新しいパスワードでログインしてください。
              </p>
              <a
                href="/login"
                className="app-btn-primary"
                style={{ display: "inline-block", padding: "14px 32px", fontSize: 15, textDecoration: "none" }}
              >
                ログインへ進む
              </a>
            </>
          )}

        </div>
      </main>
    </div>
  );
}

export default function AuthResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="app-page">
        <AppHeader variant="auth" />
        <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 56px)" }}>
          <div className="loading-spinner" />
        </main>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
