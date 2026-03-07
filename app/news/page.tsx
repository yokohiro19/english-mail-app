"use client";

import { useState } from "react";
import "../landing.css";

const h2Style: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, marginTop: 36, marginBottom: 12, color: "var(--dark-navy)",
};

const news = [
  {
    date: "2026年2月20日",
    category: "新機能",
    categoryColor: "#2A3B6F",
    title: "マンスリーレポート機能を追加しました",
    body: (
      <>
        <p>いつもTapSmart Englishをご利用いただき、ありがとうございます。</p>
        <p style={{ marginTop: 12 }}>ご利用者の皆様からの要望を受け、毎月の初めに、先月1ヶ月分の学習記録をまとめた<strong>「マンスリーレポート」</strong>の配信を開始いたしました。</p>
        <p style={{ marginTop: 12 }}>レポートには、読んだ英文の数・継続した日数・難易度の変化などを掲載予定です。「続いてるじゃん、自分」と思える瞬間を、これからも一緒に増やしていきましょう。</p>
        <p style={{ marginTop: 12 }}>引き続き、毎日の継続を応援しています。</p>
      </>
    ),
  },
  {
    date: "2026年2月6日",
    category: "重要なお知らせ",
    categoryColor: "#B45309",
    title: "プライバシーポリシー改定のお知らせ",
    body: (
      <>
        <p>プライバシーポリシーを一部改定しました。</p>
        <p style={{ marginTop: 12 }}>今回の主な変更点は、<strong>アカウント削除後に保持していたハッシュ化済みメールアドレスの保存期間を、最大1年間に短縮</strong>したことです。これまで明確な期限を設けていなかった部分を整理し、より透明性のある運用にしました。</p>
        <p style={{ marginTop: 12 }}>引き続き、安心してご利用いただけるサービスを目指してまいります。詳しくは<a href="/privacy" style={{ color: "var(--primary-blue)", textDecoration: "underline" }}>プライバシーポリシー</a>をご確認ください。</p>
      </>
    ),
  },
];

const PER_PAGE = 5;

export default function NewsPage() {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(news.length / PER_PAGE);
  const paginated = news.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const goTo = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
            <a href="/news">お知らせ</a>
            <a href="/voices">利用者の声</a>
            <a href="/login" className="nav-cta">ログイン</a>
          </div>
        </nav>
      </header>

      <section style={{ padding: "120px 24px 80px", maxWidth: 800, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 800, marginBottom: 8, color: "var(--dark-navy)" }}>
          お知らせ
        </h1>
        <p style={{ fontSize: 15, color: "#6B7280", marginBottom: 48 }}>
          サービスに関する最新情報をお届けします。
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {paginated.map((item, i) => (
            <article
              key={i}
              style={{
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 16,
                padding: "32px 36px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 500 }}>
                  {item.date}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: "3px 12px", borderRadius: 20,
                  background: item.categoryColor + "18",
                  color: item.categoryColor,
                  border: `1px solid ${item.categoryColor}40`,
                }}>
                  {item.category}
                </span>
              </div>
              <h2 style={{ ...h2Style, marginTop: 0, marginBottom: 16, fontSize: 20 }}>
                {item.title}
              </h2>
              <div style={{ fontSize: 15, lineHeight: 1.9, color: "#374151" }}>
                {item.body}
              </div>
            </article>
          ))}
        </div>

        {/* ページネーション */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 48 }}>
            <button
              onClick={() => goTo(page - 1)}
              disabled={page === 1}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "1.5px solid #D1D5DB",
                background: "#fff", cursor: page === 1 ? "default" : "pointer",
                color: page === 1 ? "#D1D5DB" : "var(--dark-navy)",
                fontWeight: 600, fontSize: 14,
              }}
            >
              ← 前へ
            </button>

            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i + 1)}
                style={{
                  width: 36, height: 36, borderRadius: 8, border: "1.5px solid",
                  borderColor: page === i + 1 ? "var(--dark-navy)" : "#D1D5DB",
                  background: page === i + 1 ? "var(--dark-navy)" : "#fff",
                  color: page === i + 1 ? "#fff" : "var(--dark-navy)",
                  fontWeight: 600, fontSize: 14, cursor: "pointer",
                }}
              >
                {i + 1}
              </button>
            ))}

            <button
              onClick={() => goTo(page + 1)}
              disabled={page === totalPages}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "1.5px solid #D1D5DB",
                background: "#fff", cursor: page === totalPages ? "default" : "pointer",
                color: page === totalPages ? "#D1D5DB" : "var(--dark-navy)",
                fontWeight: 600, fontSize: 14,
              }}
            >
              次へ →
            </button>
          </div>
      </section>

      <footer>
        <div className="footer-content">
          <div className="footer-brand">
            <h3>TapSmart <span style={{ color: "var(--primary-cyan)" }}>English</span></h3>
            <p>ビジネス英語を、自分の「楽しい」ペースで。<br />毎日続けられる学習体験を提供します。</p>
          </div>
          <div className="footer-links">
            <h4>プロダクト</h4>
            <ul>
              <li><a href="/#features">特徴</a></li>
              <li><a href="/#strengths">強み</a></li>
              <li><a href="/#how">使い方</a></li>
              <li><a href="/news">お知らせ</a></li>
              <li><a href="/voices">利用者の声</a></li>
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
