"use client";

import { useEffect } from "react";
import "./landing.css";

export default function Home() {
  useEffect(() => {
    const handleClick = (e: Event) => {
      const anchor = (e.target as HTMLElement).closest('a[href^="#"]');
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href === "#" || href === "#cta") return;
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        const offsetTop = (target as HTMLElement).offsetTop - 80;
        window.scrollTo({ top: offsetTop, behavior: "smooth" });
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className="landing">
      <header>
        <nav>
          <a href="#" className="logo">
            <img src="/images/logo.png" alt="TapSmart English" className="logo-img" />
          </a>
          <div className="nav-menu">
            <a href="#features">特徴</a>
            <a href="#strengths">強み</a>
            <a href="#how">使い方</a>
            <a href="/login" className="nav-cta">ログイン</a>
          </div>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-content">
          <div className="hero-text">
            <h2>
              ちょうど楽しい難易度。<br />
              だから、明日も読みたくなる。
            </h2>
            <p className="hero-subtitle">
              いつものメールボックスに、毎日届くビジネス英語。<br />
              読んでタップするだけで、継続が目に見える。
            </p>
            <div className="hero-cta">
              <a href="/signup" className="btn-primary">
                今すぐ無料で始める
                <span className="price-note">月額500円（初回7日間無料）</span>
              </a>
              <a href="#how" className="btn-secondary">使い方を見る</a>
            </div>
          </div>
          <div className="hero-visual">
            <img src="/images/hero.png" alt="ビジネスパーソン" className="hero-image hero-image-pc" />
            <img src="/images/hero_smartphone.png" alt="ビジネスパーソン" className="hero-image hero-image-sp" />
          </div>
        </div>
      </section>

      <section className="features" id="features">
        <div className="section-header">
          <h2>TapSmart Englishの特徴</h2>
          <p>自分に最適な難易度と文字数で、AIが生成した英文が毎日メールで届く。<br />無理なく続けられる、新しいビジネス英語学習。</p>
        </div>
        <div className="features-grid">
          <div className="feature-card">
            <img src="/images/feature-ai.png" alt="AI" className="feature-icon-img" />
            <h3>AIが「楽しめる難易度」でビジネス英語を作成</h3>
            <p>TOEIC・TOEFL・英検の得点目安で難易度が設定でき、ランダムのテーマであなた専用のビジネス英語を作成します。</p>
          </div>
          <div className="feature-card">
            <img src="/images/feature-mail.png" alt="メール" className="feature-icon-img" />
            <h3>いつも使うメールアドレスにお届け</h3>
            <p>
              指定したアドレスで受け取り可能。<br />
              <span style={{ fontSize: "13px", opacity: 0.8, color: "#374151" }}>※会社メールでの受け取りは社内規定をご確認ください</span>
            </p>
          </div>
          <div className="feature-card">
            <img src="/images/feature-tap.png" alt="ワンタップ" className="feature-icon-img" />
            <h3>１日１回、読んで、タップするだけ</h3>
            <p>読んで理解して、ボタンを押すだけで積み重ね。シンプルな操作で学習習慣が自然と身につきます。</p>
          </div>
        </div>
      </section>

      <section className="function-details" id="strengths">
        <div className="section-header">
          <h2>TapSmart Englishの強み</h2>
          <p>継続することを徹底サポート</p>
        </div>
        <div className="function-list">
          <div className="function-item">
            <img src="/images/strength-tap.png" alt="Tap" className="function-icon-img" />
            <div className="function-content">
              <h3>どこでもできる「Tap」するだけの簡単操作</h3>
              <p>毎日指定した時間に、英文、単語の解説、日本語訳、が記載されたメールが届くので、読んだら「Read ✔」ボタンを押すだけ</p>
            </div>
          </div>
          <div className="function-item">
            <img src="/images/strength-adjust.png" alt="調整" className="function-icon-img" />
            <div className="function-content">
              <h3>モチベーションに合わせた難易度調整</h3>
              <p>「ちょっと読むのが大変」と感じたら、文章の難易度を下げるか、単語数を下げて調整、もちろん逆も大歓迎</p>
            </div>
          </div>
          <div className="function-item">
            <img src="/images/strength-record.png" alt="記録" className="function-icon-img" />
            <div className="function-content">
              <h3>ダッシュボードで積み重ねを確認</h3>
              <p>これまでどれだけ読んだか、ダッシュボードで積み重ねを確認</p>
            </div>
          </div>
        </div>
      </section>

      <section className="how-it-works" id="how">
        <div className="section-header">
          <h2>使い方は簡単4ステップ</h2>
          <p>登録から学習開始まで、わずか3分</p>
        </div>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>無料アカウント登録</h3>
              <p>メールアドレスだけで簡単に登録完了。今すぐ始められます。</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>学習設定をカスタマイズ</h3>
              <p>難易度、文字数、配信時間、受け取りメールアドレスを設定。</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>毎日メールを受け取る</h3>
              <p>指定した時間に、ビジネスシーンで使える英文がメールで届きます。</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h3>読んで記録を残す</h3>
              <p>英文を読んだら「Read✔️」ボタンをタップ。学習記録が残り、継続の励みになります。</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section" id="cta">
        <div className="cta-content">
          <h2>今日から<span className="cta-highlight">毎日の英語習慣</span>を始めよう</h2>
          <div style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(10px)",
            padding: "45px 70px",
            borderRadius: "20px",
            margin: "30px auto",
            maxWidth: "520px",
            border: "2px solid rgba(255, 255, 255, 0.8)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
          }}>
            <p style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px", color: "var(--dark-navy)" }}>
              月額500円（初回7日間無料）
            </p>
            <p style={{ fontSize: "16px", color: "var(--dark-navy)", opacity: 0.7, marginBottom: "30px" }}>
              いつでもキャンセル可能
            </p>
            <a
              href="/signup"
              className="btn-primary"
              style={{ fontSize: "20px", padding: "18px 50px", width: "100%", textAlign: "center", display: "block" }}
            >
              無料で始める →
              <span className="price-note">月額500円（初回7日間無料）</span>
            </a>
          </div>
        </div>
      </section>

      <footer>
        <div className="footer-content">
          <div className="footer-brand">
            <h3>TapSmart <span style={{ color: "var(--primary-cyan)" }}>English</span></h3>
            <p>ビジネス英語を、自分のペースで。<br />毎日続けられる学習体験を提供します。</p>
          </div>
          <div className="footer-links">
            <h4>プロダクト</h4>
            <ul>
              <li><a href="#features">特徴</a></li>
              <li><a href="#strengths">強み</a></li>
              <li><a href="#how">使い方</a></li>
            </ul>
          </div>
          <div className="footer-links">
            <h4>その他</h4>
            <ul>
              <li><a href="/contact">お問い合わせ</a></li>
              <li><a href="/terms">利用規約</a></li>
              <li><a href="/privacy">プライバシーポリシー</a></li>
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
