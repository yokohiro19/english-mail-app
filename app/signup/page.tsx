"use client";

import { useState, useEffect } from "react";
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../src/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
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
        router.replace("/routine");
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

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const user = result.user;
      const isNew = user.metadata.creationTime === user.metadata.lastSignInTime;
      if (isNew) {
        try {
          const raw = localStorage.getItem("utm_data");
          const utm = raw ? JSON.parse(raw) : null;
          const userData: Record<string, any> = { email: user.email, createdAt: serverTimestamp() };
          if (utm && typeof utm === "object") userData.utm = utm;
          await setDoc(doc(db, "users", user.uid), userData, { merge: true });
          if (utm) localStorage.removeItem("utm_data");
        } catch {}
        if (typeof (window as any).gtag === "function") {
          (window as any).gtag("set", "user_data", { email: user.email?.trim().toLowerCase() });
        }
      }
      router.push("/routine");
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
        setError("Googleログインに失敗しました。");
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
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();
      await fetch("/api/send-verification", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      }).catch(() => {});

      // UTM パラメータを Firestore に保存
      try {
        const raw = localStorage.getItem("utm_data");
        const utm = raw ? JSON.parse(raw) : null;
        const userData: Record<string, any> = { email, createdAt: serverTimestamp() };
        if (utm && typeof utm === "object") userData.utm = utm;
        await setDoc(doc(db, "users", cred.user.uid), userData, { merge: true });
        if (utm) localStorage.removeItem("utm_data");
      } catch {}

      // Google Ads: 拡張コンバージョン用にメールアドレスをセット
      if (typeof (window as any).gtag === "function") {
        (window as any).gtag("set", "user_data", {
          email: email.trim().toLowerCase(),
        });
      }

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

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 4px" }}>
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
              color: "#374151", marginTop: 12,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
            Googleで新規登録
          </button>

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
