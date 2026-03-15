"use client";

import { useState } from "react";
import "../app.css";
import AppHeader from "../components/AppHeader";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/send-reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (res.ok) {
        setSent(true);
      } else if (json.error === "user_not_found") {
        setError("このメールアドレスは登録されていません。");
      } else if (json.error === "invalid_email") {
        setError("メールアドレスの形式が正しくありません。");
      } else if (json.error === "too_many_requests") {
        setError("リクエストが多すぎます。しばらくしてから再度お試しください。");
      } else {
        setError("送信に失敗しました。しばらくしてから再度お試しください。");
      }
    } catch {
      setError("送信に失敗しました。接続を確認してください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-page">
      <AppHeader variant="auth" />
      <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 56px)", padding: 24 }}>
        {sent ? (
          <div className="auth-card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
              メールを送信しました
            </h1>
            <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 8, lineHeight: 1.7 }}>
              <strong style={{ color: "#1d1f42" }}>{email}</strong> にパスワード再設定用のリンクを送信しました。
            </p>
            <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 24, lineHeight: 1.7 }}>
              メール内のリンクをクリックして、新しいパスワードを設定してください。
            </p>
            <a
              href="/login"
              className="app-btn-primary"
              style={{ display: "block", width: "100%", padding: "14px 24px", fontSize: 15, textAlign: "center", textDecoration: "none" }}
            >
              ログインに戻る
            </a>
            <p style={{ marginTop: 16, fontSize: 13, color: "#9CA3AF" }}>
              メールが届かない場合は、迷惑メールフォルダを確認してください。
            </p>
          </div>
        ) : (
          <div className="auth-card">
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
              パスワードの再設定
            </h1>
            <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 24, lineHeight: 1.7 }}>
              登録済みのメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
            </p>

            <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className="form-label">メールアドレス</label>
                <input
                  className="app-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="example@email.com"
                />
              </div>

              {error && <div className="app-error">{error}</div>}

              <button
                className="app-btn-primary"
                type="submit"
                disabled={loading}
                style={{ width: "100%", padding: "12px 24px", fontSize: 16, marginTop: 8 }}
              >
                {loading ? "送信中..." : "再設定メールを送信"}
              </button>
            </form>

            <p style={{ marginTop: 24, fontSize: 14, color: "#6B7280", textAlign: "center" }}>
              <a href="/login" style={{ color: "#1d1f42", fontWeight: 600, textDecoration: "underline" }}>
                ログインに戻る
              </a>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
