"use client";

import { useState } from "react";
import "../landing.css";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const json = await res.json();
      if (json.ok) {
        setResult({ text: "お問い合わせを送信しました。返信までしばらくお待ちください。", type: "success" });
        setName("");
        setEmail("");
        setMessage("");
      } else {
        setResult({ text: json.error || "送信に失敗しました。", type: "error" });
      }
    } catch {
      setResult({ text: "送信に失敗しました。しばらくしてから再度お試しください。", type: "error" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="landing">
      <header>
        <nav>
          <a href="/" className="logo">
            <img src="/images/logo.png" alt="TapSmart English" className="logo-img" />
          </a>
          <div className="nav-menu">
            <a href="/#features">特徴</a>
            <a href="/#strengths">強み</a>
            <a href="/#how">使い方</a>
            <a href="/login" className="nav-cta">ログイン</a>
          </div>
        </nav>
      </header>

      <section style={{ padding: "120px 24px 80px", maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 800, marginBottom: 8, color: "var(--dark-navy)" }}>
          お問い合わせ
        </h1>
        <p style={{ fontSize: 15, color: "#6B7280", marginBottom: 32 }}>
          ご質問・ご要望・不具合のご報告など、お気軽にお問い合わせください。
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--dark-navy)", marginBottom: 6 }}>
              お名前 <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
              style={{
                width: "100%", padding: "12px 16px", borderRadius: 10,
                border: "1.5px solid #D1D5DB", fontSize: 15, fontFamily: "'Inter', sans-serif",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--dark-navy)", marginBottom: 6 }}>
              メールアドレス <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={320}
              style={{
                width: "100%", padding: "12px 16px", borderRadius: 10,
                border: "1.5px solid #D1D5DB", fontSize: 15, fontFamily: "'Inter', sans-serif",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--dark-navy)", marginBottom: 6 }}>
              お問い合わせ内容 <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              maxLength={5000}
              rows={8}
              style={{
                width: "100%", padding: "12px 16px", borderRadius: 10,
                border: "1.5px solid #D1D5DB", fontSize: 15, fontFamily: "'Inter', sans-serif",
                outline: "none", resize: "vertical", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ textAlign: "center" }}>
            <button
              type="submit"
              disabled={sending || !name || !email || !message}
              style={{
                background: "var(--dark-navy)", color: "#fff", fontWeight: 700,
                padding: "14px 40px", borderRadius: 12, border: "none", cursor: "pointer",
                fontSize: 16, fontFamily: "'Inter', sans-serif",
                opacity: sending || !name || !email || !message ? 0.5 : 1,
              }}
            >
              {sending ? "送信中..." : "送信する"}
            </button>
          </div>

          {result && (
            <div style={{
              padding: "12px 20px", borderRadius: 10, fontSize: 14,
              background: result.type === "success" ? "#ECFDF5" : "#FEF2F2",
              color: result.type === "success" ? "#065F46" : "#991B1B",
              border: `1px solid ${result.type === "success" ? "#A7F3D0" : "#FECACA"}`,
            }}>
              {result.text}
            </div>
          )}
        </form>
      </section>

      <footer>
        <div className="footer-content">
          <div className="footer-brand">
            <h3>TapSmart English</h3>
            <p>ビジネス英語を、自分の「楽しい」ペースで。<br />毎日続けられる学習体験を提供します。</p>
          </div>
          <div className="footer-links">
            <h4>プロダクト</h4>
            <ul>
              <li><a href="/#features">特徴</a></li>
              <li><a href="/#strengths">強み</a></li>
              <li><a href="/#how">使い方</a></li>
            </ul>
          </div>
          <div className="footer-links">
            <h4>その他</h4>
            <ul>
              <li><a href="/contact">お問い合わせ</a></li>
              <li><a href="/terms">利用規約</a></li>
              <li><a href="/privacy">プライバシーポリシー</a></li>
              <li><a href="/legal/tokushoho">特定商取引法に基づく表記</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 TapSmart English. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
