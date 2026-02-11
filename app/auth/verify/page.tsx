"use client";

import { useEffect, useState } from "react";
import { applyActionCode } from "firebase/auth";
import { auth } from "../../../src/lib/firebase";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import "../../app.css";
import AppHeader from "../../components/AppHeader";

function VerifyContent() {
  const params = useSearchParams();
  const oobCode = params.get("oobCode");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!oobCode) {
      setStatus("error");
      return;
    }
    applyActionCode(auth, oobCode)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [oobCode]);

  return (
    <div className="app-page">
      <AppHeader variant="auth" />
      <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 56px)", padding: 24 }}>
        <div className="auth-card" style={{ textAlign: "center" }}>
          {status === "loading" && (
            <>
              <div className="loading-spinner" style={{ margin: "0 auto 16px" }} />
              <p style={{ fontSize: 14, color: "#6B7280" }}>認証を処理しています…</p>
            </>
          )}
          {status === "success" && (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
                メール認証が完了しました
              </h1>
              <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 24, lineHeight: 1.7 }}>
                アカウントが有効化されました。<br />設定画面へ進んで学習を始めましょう。
              </p>
              <a
                href="/settings"
                className="app-btn-primary"
                style={{ display: "inline-block", padding: "14px 32px", fontSize: 15, textDecoration: "none" }}
              >
                設定画面へ進む
              </a>
            </>
          )}
          {status === "error" && (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
              <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
                認証に失敗しました
              </h1>
              <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 24, lineHeight: 1.7 }}>
                リンクの有効期限が切れているか、既に使用済みです。<br />
                再度認証メールを送信してください。
              </p>
              <a
                href="/verify-email"
                className="app-btn-secondary"
                style={{ display: "inline-block", padding: "12px 32px", fontSize: 14, textDecoration: "none" }}
              >
                認証メール再送信ページへ
              </a>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="app-page">
        <AppHeader variant="auth" />
        <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 56px)" }}>
          <div className="loading-spinner" />
        </main>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
