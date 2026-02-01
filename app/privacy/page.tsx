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
            <a href="/signup" className="nav-cta">無料で始める</a>
          </div>
        </nav>
      </header>

      <section style={{ padding: "120px 24px 80px", maxWidth: 800, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 800, marginBottom: 8, color: "var(--dark-navy)" }}>
          プライバシーポリシー
        </h1>
        <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 40 }}>最終更新日: 2026年2月2日</p>

        <div style={{ fontSize: 15, lineHeight: 1.9, color: "#374151" }}>
          <p>TapSmart English（以下「本サービス」）を運営する運営者（以下「当社」）は、ユーザーの個人情報の保護を重要と考え、以下のとおりプライバシーポリシー（以下「本ポリシー」）を定めます。</p>

          <h2 style={h2Style}>1. 収集する情報</h2>
          <p>当社は、本サービスの提供にあたり、以下の情報を収集します。</p>
          <ul style={ulStyle}>
            <li><strong>アカウント情報:</strong> メールアドレス、パスワード（暗号化して保存）、ニックネーム</li>
            <li><strong>利用設定情報:</strong> 学習レベル、配信時間、単語数、配信先メールアドレス</li>
            <li><strong>学習記録:</strong> メールの閲覧記録（日付・回数）</li>
            <li><strong>決済情報:</strong> Stripe を通じて処理されるクレジットカード情報（当社はカード番号を直接保持しません）</li>
            <li><strong>お問い合わせ情報:</strong> お名前、メールアドレス、お問い合わせ内容</li>
            <li><strong>自動収集情報:</strong> アクセスログ、IPアドレス、ブラウザ情報、Cookie等</li>
          </ul>

          <h2 style={h2Style}>2. 情報の利用目的</h2>
          <p>当社は、収集した情報を以下の目的で利用します。</p>
          <ul style={ulStyle}>
            <li>本サービスの提供・運営・改善</li>
            <li>ユーザーの学習設定に基づくメール配信</li>
            <li>ユーザーサポートおよびお問い合わせへの対応</li>
            <li>有料プランの決済処理</li>
            <li>サービスの利用状況の分析・統計</li>
            <li>規約違反行為への対応</li>
            <li>本サービスに関する重要なお知らせの送信</li>
            <li>その他、上記利用目的に付随する業務</li>
          </ul>

          <h2 style={h2Style}>3. 第三者への提供</h2>
          <p>当社は、以下の場合を除き、ユーザーの個人情報を第三者に提供しません。</p>
          <ul style={ulStyle}>
            <li>ユーザーの同意がある場合</li>
            <li>法令に基づく場合</li>
            <li>人の生命・身体または財産の保護のために必要であり、本人の同意を得ることが困難な場合</li>
            <li>公衆衛生の向上または児童の健全な育成の推進のために特に必要な場合</li>
            <li>国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を遂行する場合</li>
          </ul>

          <h2 style={h2Style}>4. 外部サービスの利用</h2>
          <p>本サービスでは、以下の外部サービスを利用しています。各サービスのプライバシーポリシーもあわせてご確認ください。</p>
          <ul style={ulStyle}>
            <li><strong>Firebase (Google):</strong> 認証・データベース</li>
            <li><strong>Stripe:</strong> 決済処理</li>
            <li><strong>Resend:</strong> メール配信</li>
            <li><strong>OpenAI:</strong> AI による英文生成</li>
            <li><strong>Vercel:</strong> ホスティング</li>
          </ul>
          <p>これらの外部サービスに対し、サービス提供に必要な範囲で情報が送信されます。</p>

          <h2 style={h2Style}>5. Cookie の利用</h2>
          <p>本サービスは、ユーザーの認証状態の維持やサービスの改善のためにCookieを使用します。ユーザーはブラウザの設定によりCookieの受け入れを拒否できますが、その場合、本サービスの一部機能が利用できなくなる場合があります。</p>

          <h2 style={h2Style}>6. 情報の安全管理</h2>
          <p>当社は、収集した個人情報の漏洩・毀損・滅失の防止その他の安全管理のために、合理的な技術的・組織的措置を講じます。ただし、インターネット上の通信やデータ保存において完全な安全性を保証することはできません。</p>

          <h2 style={h2Style}>7. データの保存期間</h2>
          <ul style={ulStyle}>
            <li>アカウント情報・学習記録: アカウント削除まで保存します。</li>
            <li>お問い合わせ情報: 対応完了後、合理的な期間保存した後に削除します。</li>
            <li>決済情報: Stripe の規定に従い保存されます。</li>
          </ul>
          <p>アカウント削除後、バックアップからの完全な削除には一定期間を要する場合があります。</p>

          <h2 style={h2Style}>8. ユーザーの権利</h2>
          <p>ユーザーは、以下の権利を有します。</p>
          <ul style={ulStyle}>
            <li><strong>アクセス・訂正:</strong> アカウント設定画面から、ご自身の登録情報を確認・変更できます。</li>
            <li><strong>削除:</strong> アカウント設定画面からアカウントを削除できます。削除により、ユーザーに関連する情報は消去されます。</li>
            <li><strong>お問い合わせ:</strong> 上記に関するご請求は、お問い合わせフォームまたは下記連絡先までご連絡ください。</li>
          </ul>

          <h2 style={h2Style}>9. 未成年のユーザー</h2>
          <p>本サービスは、13歳未満の方を対象としておりません。13歳未満の方が個人情報を提供していることが判明した場合、速やかに当該情報を削除します。</p>

          <h2 style={h2Style}>10. プライバシーポリシーの変更</h2>
          <ol style={olStyle}>
            <li>当社は、必要に応じて本ポリシーを変更できるものとします。</li>
            <li>変更後のプライバシーポリシーは、本サービス上に掲載した時点で効力を生じるものとします。</li>
            <li>重要な変更がある場合は、本サービス上または登録メールアドレスへの通知により周知いたします。</li>
          </ol>

          <h2 style={h2Style}>11. お問い合わせ窓口</h2>
          <p>本ポリシーに関するお問い合わせは、以下の窓口までお願いいたします。</p>
          <div style={{ marginTop: 12, padding: "16px 20px", background: "#F9FAFB", borderRadius: 12, fontSize: 14 }}>
            <p>TapSmart English サポート</p>
            <p>メール: support@tapsmart.jp</p>
            <p><a href="/contact" style={{ color: "var(--accent-cyan)" }}>お問い合わせフォーム</a></p>
          </div>

          <div style={{ marginTop: 48, padding: "20px 24px", background: "#F9FAFB", borderRadius: 12, fontSize: 14, color: "#6B7280" }}>
            <p>以上</p>
          </div>
        </div>
      </section>

      <footer>
        <div className="footer-content">
          <div className="footer-brand">
            <h3>TapSmart English</h3>
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

const olStyle: React.CSSProperties = {
  paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8,
};

const ulStyle: React.CSSProperties = {
  paddingLeft: 20, marginTop: 8, display: "flex", flexDirection: "column", gap: 4,
};
