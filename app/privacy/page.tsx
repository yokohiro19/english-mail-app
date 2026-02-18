"use client";

import "../landing.css";

export default function PrivacyPage() {
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
          プライバシーポリシー
        </h1>
        <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 40 }}>最終更新日: 2026年2月18日</p>

        <div style={{ fontSize: 15, lineHeight: 1.9, color: "#374151" }}>
          <p>TapSmart English（以下「当社」）は、TapSmart Englishが提供する各種サービス（以下「本サービス」）における個人情報の取扱いについて、以下のとおり定めます。</p>
          <p>本サービスは主として日本国内のユーザーを対象として提供されており、個人情報の取扱いは日本の法令を前提としています。</p>

          <h2 style={h2Style}>1. 事業者情報</h2>
          <p>本サービスの運営者に関する情報（事業者名、所在地、連絡先等）については、「<a href="/legal/tokushoho" style={{ color: "#2A3B6F" }}>特定商取引法に基づく表記</a>」ページをご参照ください。</p>

          <h2 style={h2Style}>2. 取得する情報</h2>
          <p>当社は、本サービスの提供にあたり、以下の情報を取得することがあります。</p>
          <ul style={ulStyle}>
            <li>メールアドレス（ログイン用および配信先として指定されたメールアドレスを含む）、パスワード（パスワードはハッシュ化等の不可逆的処理を施したもの）</li>
            <li>ニックネーム、学習設定情報</li>
            <li>学習履歴、利用状況</li>
            <li>決済履歴、有料プランの利用状況（※クレジットカード情報は決済代行事業者が管理し、当社は保持しません）</li>
            <li>お問い合わせ内容</li>
            <li>アクセスログ、IPアドレス、Cookie等の技術情報</li>
          </ul>

          <h2 style={h2Style}>3. 利用目的</h2>
          <p>取得した情報は、以下の目的で利用します。</p>
          <ul style={ulStyle}>
            <li>本サービスの提供、維持、管理</li>
            <li>利用状況の分析、不正行為（多重登録、不正決済、BOT利用等）の防止および対応</li>
            <li>お問い合わせへの対応</li>
            <li>決済処理および利用状況の管理</li>
            <li>法令の遵守および利用規約違反への対応</li>
          </ul>

          <h2 style={h2Style}>4. 第三者提供・業務委託・国外での取扱い</h2>
          <p>当社は、本サービスの運営に必要な範囲で、以下の業務を第三者に委託することがあります。</p>
          <ul style={ulStyle}>
            <li>決済処理（Stripe, Inc.）</li>
            <li>AI関連サービス（OpenAI API 等）</li>
            <li>サーバーおよびインフラ管理（Vercel Inc.、Google LLC（Firebase））</li>
            <li>広告配信・効果測定（Meta Platforms, Inc.）</li>
            <li>メール配信、システム運用等</li>
          </ul>
          <p>これらの委託先には、日本国外（主に米国）に所在する事業者が含まれる場合があり、ユーザーの個人情報が国外で取り扱われることがあります。</p>
          <p>当社は、委託先が所在する国または地域の個人情報保護制度を確認した上で、契約その他の方法により、個人情報保護法を踏まえた合理的かつ適切な安全管理措置を講じます。</p>

          <h2 style={h2Style}>5. AIサービスの利用</h2>
          <p>当社は、本サービスの機能提供のため、外部のAI関連サービス（例：OpenAI API 等）を利用することがあります。</p>
          <p>AI関連サービスに送信される情報は、学習レベル・単語数・トピック情報など、システムが定義したコンテンツ生成用のパラメータに限定されています。ユーザーが入力・記録した情報（メールアドレス、学習履歴、お問い合わせ内容等）がAI関連サービスに送信されることはありません。</p>
          <p>AIにより生成されるコンテンツは学習補助を目的とするものであり、その正確性、完全性、特定の成果等を当社が保証するものではありません。</p>

          <h2 style={h2Style}>6. 未成年者の利用</h2>
          <p>18歳未満のユーザーが本サービスを利用する場合、事前に法定代理人（保護者等）の同意を得た上で利用するものとします。</p>

          <h2 style={h2Style}>7. Cookie等の利用</h2>
          <p>当社は、本サービスの提供および利便性向上のため、Cookie等の技術を使用します。また、広告配信および効果測定のため、Meta Pixel等のトラッキング技術を使用し、ユーザーのアクセス情報が広告配信事業者に送信されることがあります。</p>
          <p>ユーザーは、ブラウザの設定によりCookieを無効化することができますが、その場合、本サービスの一部機能が利用できないことがあります。</p>

          <h2 style={h2Style}>8. 安全管理</h2>
          <p>当社は、個人情報の管理について、法令に従い必要かつ適切な安全管理措置を講じます。ただし、インターネット通信の性質上、情報の完全な安全性を保証するものではありません。</p>

          <h2 style={h2Style}>9. 保存期間</h2>
          <p>当社は、以下の目的に必要な範囲で個人情報を保持します。</p>
          <ul style={ulStyle}>
            <li>アカウント情報・学習履歴：法令対応、不正防止、紛争対応等に必要な期間（不正利用防止のため、退会後もメールアドレスから生成した照合用の不可逆的ハッシュ値を最大2年間保持します。保持期間経過後は自動的に削除されます）</li>
            <li>お問い合わせ情報：対応完了後、一定期間</li>
            <li>決済関連情報：法令および決済事業者の定める期間</li>
          </ul>
          <p>目的達成後は、適切な方法により削除または匿名化します。</p>

          <h2 style={h2Style}>10. 開示・訂正・利用停止等</h2>
          <p>ユーザーは、法令の定めに従い、自己の個人情報について、開示、訂正、利用停止等を請求することができます。</p>

          <h2 style={h2Style}>11. ポリシーの変更</h2>
          <p>本ポリシーは、法令の改正やサービス内容の変更等に応じて変更されることがあります。変更後の内容は、本サービス上に表示された時点で効力を生じます。</p>

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
