"use client";

import { useState } from "react";
import AppHeader from "../components/AppHeader";
import "../app.css";

export default function UnsubscribePage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="app-page">
      <AppHeader variant="auth" />
      <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 56px)", padding: 24 }}>
        <div className="auth-card" style={{ textAlign: "center" }}>

          {status === "done" ? (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
                配信停止が完了しました
              </h1>
              <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.8 }}>
                プロモーションメールの配信を停止しました。<br />
                ※パスワードリセット等のサービスメールは引き続き届く場合があります。
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
              <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
                メール配信停止
              </h1>
              <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 24, lineHeight: 1.7 }}>
                配信停止を希望するメールアドレスを入力してください。
              </p>
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "left" }}>
                <div>
                  <label className="form-label">メールアドレス</label>
                  <input
                    className="app-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {status === "error" && (
                  <p style={{ fontSize: 13, color: "#991B1B" }}>
                    エラーが発生しました。時間をおいて再度お試しください。
                  </p>
                )}
                <button
                  className="app-btn-primary"
                  type="submit"
                  disabled={status === "loading"}
                  style={{ width: "100%", padding: "14px 24px", fontSize: 15 }}
                >
                  {status === "loading" ? "処理中..." : "配信を停止する"}
                </button>
              </form>
            </>
          )}

        </div>
      </main>
    </div>
  );
}
