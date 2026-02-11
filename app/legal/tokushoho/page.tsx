import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | TapSmart English",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
  other: {
    "CCBot": "nofollow",
    "GPTBot": "nofollow",
    "Google-Extended": "nofollow",
    "anthropic-ai": "nofollow",
  },
};

export default function TokushohoPage() {
  return (
    <>
      <div
        data-nosnippet=""
        data-noai=""
        data-nollm=""
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "48px 20px 80px",
          fontFamily: "sans-serif",
          color: "#1d1f42",
          lineHeight: 1.8,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 32 }}>
          特定商取引法に基づく表記
        </h1>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 14,
          }}
        >
          <tbody>
            <Row label="販売事業者" value="○○" />
            <Row label="代表者" value="○○" />
            <Row label="所在地" value="○○" />
            <Row label="電話番号" value="○○" />
            <Row label="メールアドレス" value="○○" />
            <Row label="販売URL" value="https://tapsmart-english.com" />
            <Row label="販売価格" value="月額500円（税込）" />
            <Row label="商品代金以外の必要料金" value="なし（インターネット接続料金はお客様のご負担となります）" />
            <Row label="支払方法" value="クレジットカード（Stripe経由）" />
            <Row label="支払時期" value="初回登録時（7日間無料トライアル後に課金開始）" />
            <Row label="商品の引渡時期" value="お申し込み完了後、翌日よりメール配信を開始" />
            <Row label="返品・キャンセルについて" value="デジタルコンテンツの性質上、返品・返金はお受けできません。サブスクリプションはいつでも解約可能で、解約後は次回更新日以降の課金は発生しません。" />
            <Row label="解約方法" value="設定画面よりいつでも解約可能" />
            <Row label="動作環境" value="インターネットに接続可能な環境、メール受信が可能な端末" />
          </tbody>
        </table>

        <div style={{ marginTop: 48, textAlign: "center" }}>
          <a
            href="/"
            style={{
              color: "#2A3B6F",
              fontSize: 14,
              textDecoration: "underline",
            }}
          >
            トップページに戻る
          </a>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th
        style={{
          textAlign: "left",
          verticalAlign: "top",
          padding: "14px 16px",
          borderBottom: "1px solid #E8EAED",
          whiteSpace: "nowrap",
          fontWeight: 600,
          fontSize: 13,
          color: "#374151",
          background: "#F9FAFB",
          width: "30%",
        }}
      >
        {label}
      </th>
      <td
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid #E8EAED",
          fontSize: 14,
          color: "#1d1f42",
        }}
      >
        {value}
      </td>
    </tr>
  );
}
