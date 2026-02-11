"use client";

import { useState, useEffect } from "react";
import { createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth } from "../../src/lib/firebase";
import { useRouter } from "next/navigation";
import "../app.css";
import AppHeader from "../components/AppHeader";

function firebaseErrorJa(err: any): string {
  const code = typeof err?.code === "string" ? err.code : "";
  switch (code) {
    case "auth/email-already-in-use": return "このメールアドレスは既に登録されています。";
    case "auth/invalid-email": return "メールアドレスの形式が正しくありません。";
    case "auth/weak-password": return "パスワードが短すぎます。6文字以上にしてください。";
    case "auth/operation-not-allowed": return "この操作は許可されていません。";
    case "auth/too-many-requests": return "リクエストが多すぎます。しばらくしてから再度お試しください。";
    case "auth/network-request-failed": return "ネットワークエラーが発生しました。接続を確認してください。";
    default: return "アカウント作成に失敗しました。";
  }
}

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/settings");
      } else {
        setCheckingAuth(false);
      }
    });
    return () => unsub();
  }, [router]);

  if (checkingAuth) {
    return (
      <div className="app-page">
        <AppHeader variant="auth" />
        <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 56px)" }}>
          <div className="loading-spinner" />
        </main>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();
      await fetch("/api/send-verification", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      }).catch(() => {});
      router.push("/verify-email");
    } catch (err: any) {
      setError(firebaseErrorJa(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-page">
      <AppHeader variant="auth" />
      <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 56px)", padding: 24 }}>
        <div className="auth-card">
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 24 }}>
            新規登録
          </h1>

          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label className="form-label">メールアドレス</label>
              <input className="app-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div>
              <label className="form-label">パスワード</label>
              <input className="app-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              <p className="form-helper">6文字以上</p>
            </div>

            {error && <div className="app-error">{error}</div>}

            <button className="app-btn-primary" type="submit" disabled={loading} style={{ width: "100%", padding: "12px 24px", fontSize: 16 }}>
              {loading ? "作成中..." : "アカウント作成"}
            </button>
          </form>

          <p style={{ marginTop: 20, fontSize: 14, color: "#6B7280" }}>
            既にアカウントをお持ちの方は{" "}
            <a href="/login" style={{ color: "#1d1f42", fontWeight: 600, textDecoration: "underline" }}>
              ログイン
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
