"use client";

import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, OAuthProvider, onAuthStateChanged } from "firebase/auth";
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
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/routine");
      } else {
        setCheckingAuth(false);
      }
    });
    return () => unsub();
  }, [router]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      router.push("/routine");
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
        setError("Googleログインに失敗しました。");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new OAuthProvider("apple.com");
      provider.addScope("email");
      provider.addScope("name");
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email ?? "";
      if (!email || email.endsWith("@privaterelay.appleid.com")) {
        await result.user.delete().catch(() => {});
        setError("メールアドレスの共有が必要です。Appleサインインで「メールアドレスを共有する」を選択してください。");
        return;
      }
      router.push("/routine");
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
        setError("Apple Sign-Inに失敗しました。");
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/routine");
    } catch (err: any) {
      setError(firebaseErrorJa(err));
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="app-page">
      <AppHeader variant="auth" />
      <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 56px)", padding: 24 }}>
        <div className="auth-card">
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 24 }}>
            ログイン
          </h1>

          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label className="form-label">メールアドレス</label>
              <input className="app-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div>
              <label className="form-label">パスワード</label>
              <input className="app-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            {error && <div className="app-error">{error}</div>}

            <button className="app-btn-primary" type="submit" disabled={loading} style={{ width: "100%", padding: "12px 24px", fontSize: 16, marginTop: 16 }}>
              {loading ? "ログイン中..." : "ログイン"}
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "36px 0 0" }}>
            <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
            <span style={{ fontSize: 13, color: "#9CA3AF" }}>または</span>
            <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              width: "100%", padding: "11px 24px", borderRadius: 10, fontSize: 15, fontWeight: 600,
              border: "1.5px solid #D1D5DB", background: "#fff", cursor: "pointer",
              color: "#374151", marginTop: 24,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
            Googleでログイン
          </button>

          <button
            type="button"
            onClick={handleAppleSignIn}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              width: "100%", padding: "11px 24px", borderRadius: 10, fontSize: 15, fontWeight: 600,
              border: "1.5px solid #000", background: "#000", cursor: "pointer",
              color: "#fff", marginTop: 20,
            }}
          >
            <svg width="18" height="22" viewBox="0 0 814 1000"><path fill="#fff" d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663.3 0 541.8c0-207.4 135.4-317 269-317 67.2 0 123.1 44.5 164.7 44.5 39.5 0 101.1-47 176.3-47 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/></svg>
            Appleでログイン
          </button>

          <p style={{ marginTop: 20, fontSize: 14, color: "#6B7280", textAlign: "center" }}>
            アカウントをお持ちでない方は{" "}
            <a href="/signup" style={{ color: "#1d1f42", fontWeight: 600, textDecoration: "underline" }}>
              新規登録
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
