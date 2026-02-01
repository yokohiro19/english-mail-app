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
            <a href="/signup" className="nav-cta">無料で始める</a>
          </div>
        </nav>
      </header>

      <section style={{ padding: "120px 24px 80px", maxWidth: 800, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 800, marginBottom: 8, color: "var(--dark-navy)" }}>
          利用規約
        </h1>
        <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 40 }}>最終更新日: 2026年2月2日</p>

        <div style={{ fontSize: 15, lineHeight: 1.9, color: "#374151" }}>
          <p>この利用規約（以下「本規約」）は、TapSmart English（以下「本サービス」）の利用条件を定めるものです。ユーザーの皆さまには、本規約に同意いただいた上で本サービスをご利用いただきます。</p>

          <h2 style={h2Style}>第1条（適用）</h2>
          <p>本規約は、ユーザーと本サービス運営者（以下「運営者」）との間の本サービスの利用に関わる一切の関係に適用されます。運営者が本サービス上で掲載する個別規定やガイドラインも、本規約の一部を構成するものとします。</p>

          <h2 style={h2Style}>第2条（利用登録）</h2>
          <ol style={olStyle}>
            <li>登録希望者が運営者の定める方法によって利用登録を申請し、運営者がこれを承認することによって利用登録が完了するものとします。</li>
            <li>運営者は、以下の場合に利用登録を拒否することがあり、その理由について一切の開示義務を負わないものとします。
              <ul style={ulStyle}>
                <li>虚偽の事項を届け出た場合</li>
                <li>本規約に違反したことがある者からの申請である場合</li>
                <li>その他、運営者が利用登録を相当でないと判断した場合</li>
              </ul>
            </li>
          </ol>

          <h2 style={h2Style}>第3条（アカウント管理）</h2>
          <ol style={olStyle}>
            <li>ユーザーは、自己の責任においてアカウント情報（メールアドレス、パスワード等）を適切に管理するものとします。</li>
            <li>ユーザーは、いかなる場合にもアカウントを第三者に譲渡・貸与することはできません。</li>
            <li>アカウント情報の管理不十分、第三者の使用等による損害の責任はユーザーが負うものとし、運営者は一切の責任を負いません。</li>
          </ol>

          <h2 style={h2Style}>第4条（有料プラン・支払い）</h2>
          <ol style={olStyle}>
            <li>有料プランの料金は、本サービス上に表示する金額とします。運営者は、料金を事前の通知なく変更できるものとします。ただし、変更前に契約済みの有料期間には影響しません。</li>
            <li>支払いはクレジットカード等の運営者が指定する方法で行うものとします。</li>
            <li>ユーザーが支払いを怠った場合、運営者はサービスの提供を停止できるものとします。</li>
            <li>いったん支払われた料金は、法令に定めがある場合を除き、返金いたしません。</li>
          </ol>

          <h2 style={h2Style}>第5条（無料トライアル）</h2>
          <ol style={olStyle}>
            <li>運営者は、新規ユーザーに対し無料トライアル期間を提供する場合があります。</li>
            <li>無料トライアル期間中にキャンセルしない場合、自動的に有料プランに移行します。</li>
            <li>無料トライアルの提供条件は、運営者の判断により変更・終了する場合があります。</li>
          </ol>

          <h2 style={h2Style}>第6条（禁止事項）</h2>
          <p>ユーザーは、本サービスの利用にあたり以下の行為をしてはなりません。</p>
          <ul style={ulStyle}>
            <li>法令または公序良俗に違反する行為</li>
            <li>犯罪行為に関連する行為</li>
            <li>本サービスのサーバーまたはネットワークに過度の負荷をかける行為</li>
            <li>本サービスの運営を妨害する行為</li>
            <li>他のユーザーの情報を収集する行為</li>
            <li>不正アクセスまたはこれを試みる行為</li>
            <li>他のユーザーに成りすます行為</li>
            <li>本サービスのコンテンツを無断で複製・転載・再配布する行為</li>
            <li>反社会的勢力に対する利益供与その他の協力行為</li>
            <li>その他、運営者が不適切と判断する行為</li>
          </ul>

          <h2 style={h2Style}>第7条（本サービスの提供の停止等）</h2>
          <ol style={olStyle}>
            <li>運営者は、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止・中断できるものとします。
              <ul style={ulStyle}>
                <li>本サービスにかかるシステムの保守点検・更新を行う場合</li>
                <li>地震、落雷、火災、停電、天災等の不可抗力により提供が困難となった場合</li>
                <li>コンピュータまたは通信回線等が事故により停止した場合</li>
                <li>その他、運営者が提供の停止・中断を必要と判断した場合</li>
              </ul>
            </li>
            <li>運営者は、本サービスの停止・中断によりユーザーまたは第三者が被った不利益や損害について、一切の責任を負いません。</li>
          </ol>

          <h2 style={h2Style}>第8条（利用制限および登録抹消）</h2>
          <ol style={olStyle}>
            <li>運営者は、ユーザーが以下のいずれかに該当すると判断した場合、事前の通知なくユーザーの利用を制限し、またはアカウントを抹消できるものとします。
              <ul style={ulStyle}>
                <li>本規約に違反した場合</li>
                <li>登録事項に虚偽の事実があることが判明した場合</li>
                <li>料金等の支払債務の不履行があった場合</li>
                <li>運営者からの連絡に対し、一定期間返答がない場合</li>
                <li>その他、運営者が本サービスの利用を適当でないと判断した場合</li>
              </ul>
            </li>
            <li>運営者は、本条に基づく措置によりユーザーに生じた損害について、一切の責任を負いません。</li>
          </ol>

          <h2 style={h2Style}>第9条（退会）</h2>
          <p>ユーザーは、本サービス上のアカウント設定画面からいつでも退会手続きを行うことができます。退会した場合、ユーザーに関する一切のデータが削除される場合があり、復元はできません。</p>

          <h2 style={h2Style}>第10条（コンテンツの権利）</h2>
          <ol style={olStyle}>
            <li>本サービスが提供するコンテンツ（AI生成の英文、翻訳、解説等を含む）に関する著作権その他の知的財産権は運営者に帰属します。</li>
            <li>ユーザーは、本サービスのコンテンツを個人の学習目的に限り利用できるものとし、無断での複製・転載・商用利用を禁止します。</li>
          </ol>

          <h2 style={h2Style}>第11条（免責事項）</h2>
          <ol style={olStyle}>
            <li>運営者は、本サービスに事実上または法律上の瑕疵（安全性、信頼性、正確性、完全性、有効性、特定の目的への適合性、セキュリティ上の欠陥、エラー・バグ、権利侵害等を含む）がないことを明示的にも黙示的にも保証しません。</li>
            <li>運営者は、本サービスに起因してユーザーに生じたあらゆる損害について、運営者の故意または重大な過失による場合を除き、一切の責任を負いません。</li>
            <li>運営者がユーザーに対して損害賠償責任を負う場合であっても、その範囲は、ユーザーが過去12ヶ月間に本サービスに支払った金額を上限とします。</li>
            <li>AI生成コンテンツの正確性・適切性について、運営者は一切保証しません。学習の参考としてご利用ください。</li>
          </ol>

          <h2 style={h2Style}>第12条（サービス内容の変更等）</h2>
          <p>運営者は、ユーザーへの事前の通知なく本サービスの内容を変更し、または本サービスの提供を終了できるものとします。これによりユーザーに生じた損害について、運営者は一切の責任を負いません。</p>

          <h2 style={h2Style}>第13条（利用規約の変更）</h2>
          <ol style={olStyle}>
            <li>運営者は、必要と判断した場合には、ユーザーの個別の同意を要せず、いつでも本規約を変更できるものとします。</li>
            <li>変更後の利用規約は、本サービス上に掲載した時点で効力を生じるものとします。</li>
            <li>本規約の変更後、本サービスの利用を継続した場合、ユーザーは変更後の規約に同意したものとみなされます。</li>
          </ol>

          <h2 style={h2Style}>第14条（個人情報の取扱い）</h2>
          <p>運営者は、本サービスの利用によって取得する個人情報を、別途定める「<a href="/privacy" style={{ color: "var(--accent-cyan)" }}>プライバシーポリシー</a>」に従い適切に取り扱います。</p>

          <h2 style={h2Style}>第15条（通知または連絡）</h2>
          <p>ユーザーと運営者との間の通知または連絡は、運営者の定める方法（メール等）によって行うものとします。運営者がユーザーの登録メールアドレスに通知を送信した場合、発信時点でユーザーに到達したものとみなします。</p>

          <h2 style={h2Style}>第16条（権利義務の譲渡の禁止）</h2>
          <p>ユーザーは、運営者の書面による事前の承諾なく、利用契約上の地位または本規約に基づく権利義務を第三者に譲渡し、または担保に供することはできません。</p>

          <h2 style={h2Style}>第17条（準拠法・裁判管轄）</h2>
          <ol style={olStyle}>
            <li>本規約の解釈にあたっては、日本法を準拠法とします。</li>
            <li>本サービスに関して紛争が生じた場合には、運営者の本店所在地を管轄する裁判所を専属的合意管轄とします。</li>
          </ol>

          <div style={{ marginTop: 48, padding: "20px 24px", background: "#F9FAFB", borderRadius: 12, fontSize: 14, color: "#6B7280" }}>
            <p>以上</p>
            <p style={{ marginTop: 8 }}>お問い合わせ: <a href="/contact" style={{ color: "var(--accent-cyan)" }}>お問い合わせフォーム</a> または support@tapsmart.jp</p>
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
