"use client";

import { useEffect, useState } from "react";

// 暗号化された個人情報（販売業者・所在地・電話番号のみ暗号化）
const E = {
  rep: "LR8fvpRRZ87pJRK3vJpp77ZJWx8xRp8K8vZnZLxKZnK3nnmJf3x37n",
  address: "L3Zx3JvxKfnvqWZK7WLmvx38K8Zx78vZfpvnv8WfnL7mv8x7L77LmpfKRnLLmxLmLf83n3vxnL7mnqxWv87L37m3WKJKpxWWLfZJL3fJp383WW3RRnJqv8m8np",
  phone: "pnRpxZ3fnW7WnvxWLmxfmp8RKnLqmvnxL3Z73qRqJ8qRJRR7LxpW73ZWWfZZmW8LZpZLZLx88vKv3LmffWqJ7q37KpJq7pvvJWvpLKWqn3WLvRZp7pLf3xmLWx87RRWRp8R3xZv7nW7Wn3",
};

export default function TokushohoContent() {
  const [d, setD] = useState<Record<string, string> | null>(null);

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

  const v = (key: string) => d?.[key] ? scatter(d[key]) : "";

  if (!d) return null;

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
          <Row label="屋号" value="TapSmart English" />
          <Row label="販売業者（責任者）" value={v("rep")} />
          <Row label="所在地" value={v("address")} />
          <Row label="電話番号" value={v("phone")} />
          <Row label="メールアドレス" value="support@tapsmart.jp" />
          <Row label="販売価格" value="月額500円（税込）" />
          <Row label="商品代金以外の必要料金" value="なし（インターネット接続料金はお客様のご負担となります）" />
          <Row label="支払方法" value="クレジットカード（Stripe経由）" />
          <Row label="支払時期" value={<>
            本サービスは月額制のサブスクリプションサービスです。<br />
            初回登録日から7日間は無料トライアル期間となり、無料期間終了日の翌日に初回課金が行われます。<br />
            以降は、初回課金日を基準日として、毎月同日に自動課金されます。<br />
            支払処理は、Stripe社の決済システムを利用して行われます。
          </>} />
          <Row label="商品の引渡時期" value="お申し込み完了直後よりサービス利用可能" />
          <Row label="返品・キャンセルについて" value={<>
            本サービスはデジタルコンテンツおよびオンラインサービスという性質上、契約成立後の返品・返金には応じておりません。<br />
            ただし、初回登録後7日間の無料トライアル期間中に解約された場合、料金は発生いたしません。<br />
            サブスクリプションはいつでも解約可能です。<br />
            解約手続きは、ログイン後の設定画面より行うことができます。<br />
            解約手続き完了後は、次回更新日以降の課金は発生しません。<br />
            なお、解約後も次回更新日までは引き続きサービスをご利用いただけます。
          </>} />
          <Row label="解約方法" value="ログイン後の設定画面より、いつでも解約可能です" />
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
