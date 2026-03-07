import "../landing.css";

const voices = [
  {
    name: "Y さん",
    profile: "20代・会社員・男性",
    stars: 5,
    body: (
      <>
        <p>大学時代はTOEIC700点台をキープしていましたが、就職してから英語を使う機会が激減し、気づけば読むスピードも落ちてきていました。それでも仕事やプライベートで突然英語が必要になることがあり、「英語の勉強をちゃんと続けなければ」という焦りはずっとありました。</p>
        <p style={{ marginTop: 12 }}>まとまった時間が取れない中で出会ったのがTapSmart Englishです。毎日届くメールを1通読むだけ、という手軽さが自分には合っていました。「今日は疲れたな」というときは難易度を下げて、とにかく読んで終わりにする。それだけで継続できているのは、このサービスのシンプルさのおかげだと思っています。</p>
      </>
    ),
  },
  {
    name: "匿名希望",
    profile: null,
    stars: 5,
    body: (
      <p>「ちょうど楽しい難易度」という言葉に惹かれて始めました。やってみると、難しすぎず、簡単すぎず、本当にちょうどいい。達成感があるので、気づいたら1ヶ月続いていました。</p>
    ),
  },
];

function Stars({ count }: { count: number }) {
  return (
    <div style={{ display: "flex", gap: 2, marginBottom: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} style={{ color: "#FBBF24", fontSize: 18 }}>★</span>
      ))}
    </div>
  );
}

export default function VoicesPage() {
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

      <section className="page-section">
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 800, marginBottom: 8, color: "var(--dark-navy)" }}>
          利用者の声
        </h1>
        <p style={{ fontSize: 15, color: "#6B7280", marginBottom: 48 }}>
          TapSmart Englishをご利用いただいている方々の声をご紹介します。
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {voices.map((v, i) => (
            <article
              key={i}
              style={{
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderLeft: "4px solid var(--primary-cyan)",
                borderRadius: "0 16px 16px 0",
                padding: "28px 32px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              }}
            >
              <Stars count={v.stars} />
              <div style={{ fontSize: 15, lineHeight: 1.9, color: "#374151", marginBottom: 20 }}>
                {v.body}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--primary-blue), var(--primary-cyan))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 14, fontWeight: 700, flexShrink: 0,
                }}>
                  {v.name[0]}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--dark-navy)" }}>{v.name}</div>
                  {v.profile && (
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>{v.profile}</div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* 投稿募集 */}
        <div style={{
          marginTop: 64,
          background: "linear-gradient(135deg, var(--primary-blue) 0%, var(--dark-navy) 100%)",
          borderRadius: 20,
          padding: "40px 36px",
          textAlign: "center",
          color: "#fff",
        }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
            あなたの声をお聞かせください
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: "rgba(255,255,255,0.85)", marginBottom: 8 }}>
            TapSmart Englishを使ってみての感想を、ぜひ教えてください。
          </p>
          <p style={{ fontSize: 14, color: "var(--primary-cyan)", fontWeight: 700, marginBottom: 28 }}>
            掲載させていただいた方には、Amazonギフト券500円分をプレゼントします！
          </p>
          <a
            href="/contact?category=利用者の声投稿希望"
            style={{
              display: "inline-block",
              background: "var(--primary-cyan)",
              color: "var(--dark-navy)",
              fontWeight: 700,
              fontSize: 15,
              padding: "12px 32px",
              borderRadius: 30,
              textDecoration: "none",
            }}
          >
            投稿フォームへ →
          </a>
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
