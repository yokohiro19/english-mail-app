"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../src/lib/firebase";
import { useRouter } from "next/navigation";
import "../app.css";
import AppHeader from "../components/AppHeader";

export default function SignupPage() {
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
      await createUserWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.message ?? "Signup failed");
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
            Sign up
          </h1>

          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label className="form-label">Email</label>
              <input className="app-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div>
              <label className="form-label">Password</label>
              <input className="app-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              <p className="form-helper">6文字以上</p>
            </div>

            {error && <div className="app-error">{error}</div>}

            <button className="app-btn-primary" type="submit" disabled={loading} style={{ width: "100%", padding: "12px 24px", fontSize: 16 }}>
              {loading ? "Creating..." : "Create account"}
            </button>
          </form>

          <p style={{ marginTop: 20, fontSize: 14, color: "#6B7280" }}>
            Already have an account?{" "}
            <a href="/login" style={{ color: "#1d1f42", fontWeight: 600, textDecoration: "underline" }}>
              Log in
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
