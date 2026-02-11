"use client";

import { useEffect, useState } from "react";

// 暗号化された個人情報（encode() で生成した文字列）
const E = {
  seller: "WZW7KZZq77f8R7nxxpJWJ8qJvJxLLnRJKnvnvfx3nnWn3pxfnm73mKJWRLLnm3Lq",
  rep: "WZW7KZZq77f8R7nxxpJWJ8qJvJxLLnRJKnvnvfx3nnWn3pxfnm73mKJWRLLnm3Lq",
  address: "LvfmvRRW8vqK",
  phone: "LvfmvRRW8vqK",
  email: "LvfmvRRW8vqK",
};

export default function TokushohoContent() {
  const [d, setD] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/legal-decode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: E }),
    })
      .then((r) => r.json())
      .then((j) => { if (j.decoded) setD(j.decoded); })
      .catch(() => {});
  }, []);

  // 1文字ずつ<span>に分離 + ゼロ幅文字で検索を妨害
  const scatter = (text: string) =>
    [...text].map((ch, i) => (
      <span key={i} aria-hidden="true">
        {ch}
        {i < text.length - 1 && <span style={{ fontSize: 0 }}>{"\u200B\u200C\u200D"}</span>}
      </span>
    ));

  const v = (key: string) => d[key] ? scatter(d[key]) : "読み込み中…";

  return (
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

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <tbody>
          <Row label="販売事業者" value={v("seller")} />
          <Row label="代表者" value={v("rep")} />
          <Row label="所在地" value={v("address")} />
          <Row label="電話番号" value={v("phone")} />
          <Row label="メールアドレス" value={v("email")} />
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
        <a href="/" style={{ color: "#2A3B6F", fontSize: 14, textDecoration: "underline" }}>
          トップページに戻る
        </a>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
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
