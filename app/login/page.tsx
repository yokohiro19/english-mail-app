"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../src/lib/firebase";
import { useRouter } from "next/navigation";
import "../app.css";
import AppHeader from "../components/AppHeader";

function firebaseErrorJa(err: any): string {
  const code = typeof err?.code === "string" ? err.code : "";
  switch (code) {
    case "auth/invalid-email": return "メールアドレスの形式が正しくありません。";
    case "auth/user-disabled": return "このアカウントは無効化されています。";
    case "auth/user-not-found": return "このメールアドレスは登録されていません。";
    case "auth/wrong-password": return "パスワードが正しくありません。";
    case "auth/invalid-credential": return "メールアドレスまたはパスワードが正しくありません。";
    case "auth/too-many-requests": return "リクエストが多すぎます。しばらくしてから再度お試しください。";
    case "auth/network-request-failed": return "ネットワークエラーが発生しました。接続を確認してください。";
    default: return "ログインに失敗しました。";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
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
            Log in
          </h1>

          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label className="form-label">Email</label>
              <input className="app-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div>
              <label className="form-label">Password</label>
              <input className="app-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            {error && <div className="app-error">{error}</div>}

            <button className="app-btn-primary" type="submit" disabled={loading} style={{ width: "100%", padding: "12px 24px", fontSize: 16 }}>
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>

          <p style={{ marginTop: 20, fontSize: 14, color: "#6B7280" }}>
            New here?{" "}
            <a href="/signup" style={{ color: "#1d1f42", fontWeight: 600, textDecoration: "underline" }}>
              Create an account
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
