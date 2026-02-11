"use client";

import "../landing.css";

export default function TermsPage() {
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

      <section style={{ padding: "120px 24px 80px", maxWidth: 800, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 800, marginBottom: 8, color: "var(--dark-navy)" }}>
          利用規約
        </h1>
        <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 40 }}>最終更新日: 2026年2月6日</p>

        <div style={{ fontSize: 15, lineHeight: 1.9, color: "#374151" }}>
          <h2 style={h2Style}>第1条（適用）</h2>
          <p>本規約は、本サービスの利用に関する一切に適用されます。</p>

          <h2 style={h2Style}>第2条（利用登録）</h2>
          <p>当社は、登録申請に虚偽がある場合、または運営上不適切と判断した場合、利用登録を承認しないことがあります。</p>

          <h2 style={h2Style}>第3条（アカウント管理）</h2>
          <p>アカウント情報の管理は、ユーザー自身の責任において行うものとします。</p>

          <h2 style={h2Style}>第4条（有料プラン・支払い）</h2>
          <ul style={ulStyle}>
            <li>有料プランは月額制の自動更新プランです。</li>
            <li>料金、支払方法、更新日その他の条件は、申込画面に表示される内容に従います。</li>
            <li>ユーザーは、サービス内の解約手続により、次回更新日前までに解約することで更新を停止できます。</li>
            <li>支払済の利用料金は、デジタルコンテンツの性質上、法令で認められる場合を除き返金されません。</li>
          </ul>

          <h2 style={h2Style}>第5条（無料トライアル）</h2>
          <ul style={ulStyle}>
            <li>本サービスには7日間の無料トライアル期間があります。</li>
            <li>無料トライアル期間終了までに解約が行われない場合、有料プランへ自動的に移行します。</li>
          </ul>

          <h2 style={h2Style}>第6条（禁止事項）</h2>
          <p>ユーザーは、以下の行為を行ってはなりません。</p>
          <ul style={ulStyle}>
            <li>法令または本規約に違反する行為</li>
            <li>本サービスの不正利用、多重登録、アカウントの共有</li>
            <li>本サービスのリバースエンジニアリング、解析、複製</li>
            <li>サーバーまたはネットワークに過度な負荷をかける行為</li>
          </ul>

          <h2 style={h2Style}>第7条（サービスの変更・中断・終了）</h2>
          <p>当社は、必要に応じて本サービスの全部または一部を変更、中断、または終了することがあります。可能な場合には、事前に通知します。</p>

          <h2 style={h2Style}>第8条（利用制限・登録抹消）</h2>
          <p>当社は、ユーザーが本規約に違反した場合等、必要に応じて利用制限または登録抹消を行うことがあります。</p>

          <h2 style={h2Style}>第9条（退会）</h2>
          <p>ユーザーは、当社所定の方法により、いつでも退会できます。退会後の個人情報の取扱いは、プライバシーポリシーに従います。</p>

          <h2 style={h2Style}>第10条（AI生成コンテンツ）</h2>
          <p>AI生成コンテンツは学習補助を目的とするものであり、特定の成果を保証するものではありません。</p>

          <h2 style={h2Style}>第11条（免責・責任制限）</h2>
          <p>当社の責任は、当社の故意または重大な過失による場合を除き、過去12か月間にユーザーが支払った利用料金の総額を上限とします。無料トライアル期間中または無料利用の場合、当社の責任は法令で認められる範囲に限定されます。</p>

          <h2 style={h2Style}>第12条（規約変更）</h2>
          <p>当社は、本規約を必要に応じて変更することができます。変更後の規約は、本サービス上に表示された時点で効力を生じます。</p>

          <h2 style={h2Style}>第13条（準拠法・管轄）</h2>
          <p>本規約は日本法を準拠法とし、本サービスに関する紛争は、当社所在地を管轄する裁判所を合意管轄とします。</p>

          <h2 style={h2Style}>第14条（個人情報）</h2>
          <p>個人情報の取扱いは、<a href="/privacy" style={{ color: "var(--accent-cyan)" }}>プライバシーポリシー</a>に従います。</p>

          <div style={{ marginTop: 48, padding: "20px 24px", background: "#F9FAFB", borderRadius: 12, fontSize: 14, color: "#6B7280" }}>
            <p>以上</p>
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

const h2Style: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, marginTop: 36, marginBottom: 12, color: "var(--dark-navy)",
  fontFamily: "'Outfit', sans-serif",
};

const ulStyle: React.CSSProperties = {
  paddingLeft: 20, marginTop: 8, display: "flex", flexDirection: "column", gap: 4,
};
