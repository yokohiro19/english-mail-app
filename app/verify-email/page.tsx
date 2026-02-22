"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../../src/lib/firebase";
import { useRouter } from "next/navigation";
import "../app.css";
import AppHeader from "../components/AppHeader";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [checking, setChecking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/login");
        return;
      }
      if (u.emailVerified) {
        router.replace("/routine");
        return;
      }
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const resendVerification = async () => {
    if (!user) return;
    setSending(true);
    setMessage(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/send-verification", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ text: "認証メールを再送信しました。受信トレイを確認してください。", type: "success" });
      } else if (res.status === 429 || json.error === "too_many_attempts") {
        setMessage({ text: "しばらく時間をおいてから再度お試しください。", type: "error" });
      } else {
        setMessage({ text: "送信に失敗しました。しばらくしてから再度お試しください。", type: "error" });
      }
    } catch {
      setMessage({ text: "送信に失敗しました。", type: "error" });
    } finally {
      setSending(false);
    }
  };

  const checkVerification = async () => {
    if (!user) return;
    setChecking(true);
    try {
      await user.reload();
      const refreshedUser = auth.currentUser;
      if (refreshedUser?.emailVerified) {
        router.replace("/routine");
      } else {
        setMessage({ text: "まだ認証が完了していません。メール内のリンクをクリックしてください。", type: "error" });
      }
    } catch {
      setMessage({ text: "確認に失敗しました。", type: "error" });
    } finally {
      setChecking(false);
    }
  };

  const deleteAndRestart = async () => {
    if (!user) return;
    if (!window.confirm("アカウントを削除して、新規登録からやり直しますか？")) return;
    setDeleting(true);
    try {
      await user.delete();
      router.replace("/signup");
    } catch {
      setMessage({ text: "削除に失敗しました。しばらくしてから再度お試しください。", type: "error" });
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="app-page">
        <AppHeader variant="auth" />
        <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 56px)" }}>
          <div className="loading-spinner" />
        </main>
      </div>
    );
  }

  return (
    <div className="app-page">
      <AppHeader variant="auth" />
      <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 56px)", padding: 24 }}>
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
            メールアドレスを確認してください
          </h1>
          <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 8, lineHeight: 1.7 }}>
            <strong style={{ color: "#1d1f42" }}>{user?.email}</strong> に認証メールを送信しました。
          </p>
          <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 24, lineHeight: 1.7 }}>
            メール内のリンクをクリックして、アカウントを有効化してください。
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              onClick={checkVerification}
              disabled={checking}
              className="app-btn-primary"
              style={{ width: "100%", padding: "14px 24px", fontSize: 15 }}
            >
              {checking ? "確認中..." : "認証を完了しました"}
            </button>

            <button
              onClick={resendVerification}
              disabled={sending}
              className="app-btn-secondary"
              style={{ width: "100%", padding: "12px 24px", fontSize: 14 }}
            >
              {sending ? "送信中..." : "認証メールを再送信"}
            </button>
          </div>

          {message && (
            <p style={{
              marginTop: 16,
              fontSize: 13,
              color: message.type === "success" ? "#059669" : "#991B1B",
            }}>
              {message.text}
            </p>
          )}

          <p style={{ marginTop: 24, fontSize: 13, color: "#9CA3AF" }}>
            メールが届かない場合は、迷惑メールフォルダを確認してください。
          </p>

          <p style={{ marginTop: 16, fontSize: 13 }}>
            <button
              onClick={deleteAndRestart}
              disabled={deleting}
              style={{
                background: "none",
                border: "none",
                color: "#9CA3AF",
                fontSize: 13,
                cursor: "pointer",
                textDecoration: "underline",
                padding: 0,
              }}
            >
              {deleting ? "処理中..." : "メールアドレスを間違えた方はこちら"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
