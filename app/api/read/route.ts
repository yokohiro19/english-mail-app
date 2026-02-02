import { NextResponse } from "next/server";
import { getAdminDb } from "@/src/lib/firebaseClient";
import { verifyReadToken } from "@/src/lib/readToken";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("t");
    if (!token) return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });

    const payload = verifyReadToken(token);
    const { uid, dateKey, deliveryId } = payload;

    const db = getAdminDb();

    // deliveries 参照（存在確認 + topicId/cefrを引っ張る）
    const deliveryRef = db.collection("deliveries").doc(deliveryId);
    const deliverySnap = await deliveryRef.get();
    if (!deliverySnap.exists) {
      return NextResponse.json({ ok: false, error: "delivery_not_found" }, { status: 404 });
    }

    const delivery = deliverySnap.data() as any;

    const logId = `${uid}_${dateKey}`;
    const logRef = db.collection("studyLogs").doc(logId);

    // 初回か2回目以降かを判定しながらログを記録
    let isFirstRead = false;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(logRef);
      if (!snap.exists) {
        isFirstRead = true;
        tx.set(logRef, {
          uid,
          dateKey,
          deliveryId,
          topicId: delivery.topicId ?? null,
          cefr: delivery.cefr ?? null,
          firstReadAt: FieldValue.serverTimestamp(),
          lastReadAt: FieldValue.serverTimestamp(),
          readCount: 1,
          userAgent: req.headers.get("user-agent") ?? null,
        });
      } else {
        isFirstRead = false;
        tx.update(logRef, {
          lastReadAt: FieldValue.serverTimestamp(),
          readCount: FieldValue.increment(1),
        });
      }
    });

    // 2回目以降 → 設定画面にリダイレクト（バナー表示付き）
    if (!isFirstRead) {
      const settingsUrl = new URL("/settings?already_read=1", url.origin);
      return NextResponse.redirect(settingsUrl.toString(), 302);
    }

    // 初回 → 読了確認ページ
    const appBaseUrl = process.env.APP_BASE_URL ?? url.origin;
    const html = buildReadPage(dateKey, appBaseUrl);
    return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 400 });
  }
}

function buildReadPage(dateKey: string, appBaseUrl: string) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Read ✔ — TapSmart English</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #F5F7FA;
      color: #1d1f42;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .header {
      background: #1d1f42;
      padding: 16px 24px;
      text-align: center;
    }
    .header-logo {
      font-family: 'Outfit', sans-serif;
      font-size: 20px;
      font-weight: 800;
      color: #4EFFF4;
      text-decoration: none;
      letter-spacing: 0.5px;
    }
    .main {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 24px;
    }
    .card {
      background: #fff;
      border-radius: 20px;
      padding: 48px 40px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.06);
    }
    .check-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      background: #4EFFF4;
      border-radius: 50%;
      margin-bottom: 24px;
      font-size: 28px;
      color: #1d1f42;
      box-shadow: 0 4px 15px rgba(78,255,244,0.3);
    }
    .title {
      font-family: 'Outfit', sans-serif;
      font-size: 28px;
      font-weight: 800;
      line-height: 1.3;
      margin-bottom: 4px;
    }
    .subtitle {
      font-family: 'Outfit', sans-serif;
      font-size: 20px;
      font-weight: 600;
      color: #6B7280;
      margin-bottom: 8px;
    }
    .date {
      font-size: 13px;
      color: #9CA3AF;
      margin-bottom: 32px;
    }
    .divider {
      height: 1px;
      background: #E8EAED;
      margin: 0 0 28px;
    }
    .adjust-title {
      font-size: 14px;
      font-weight: 600;
      color: #1d1f42;
      margin-bottom: 20px;
    }
    .guide-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 28px;
      text-align: left;
    }
    .guide-item {
      background: #F5F7FA;
      border-radius: 10px;
      padding: 12px 14px;
      font-size: 13px;
      line-height: 1.5;
    }
    .guide-label {
      color: #6B7280;
      font-weight: 500;
    }
    .guide-action {
      color: #1d1f42;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .guide-action::before {
      content: '→';
      color: #4EFFF4;
      font-weight: 800;
    }
    .btn-settings {
      display: inline-block;
      background: #1d1f42;
      color: #fff;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 36px;
      border-radius: 12px;
      text-decoration: none;
      letter-spacing: 0.3px;
      transition: opacity 0.2s;
    }
    .btn-settings:hover { opacity: 0.85; }
    .footer {
      text-align: center;
      padding: 16px 24px;
      font-size: 12px;
      color: #9CA3AF;
    }
    @media (max-width: 520px) {
      .card { padding: 36px 24px; }
      .title { font-size: 24px; }
      .subtitle { font-size: 17px; }
      .guide-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="header">
    <a href="${appBaseUrl}" class="header-logo">TapSmart English</a>
  </div>
  <div class="main">
    <div class="card">
      <div class="check-icon">✔</div>
      <div class="title">Marked as read.</div>
      <div class="subtitle">See you tomorrow.</div>
      <div class="date">${dateKey}</div>

      <div class="divider"></div>

      <div class="adjust-title">読むのが大変だった人、簡単すぎた人は、<br>難易度を調整しましょう</div>
      <div class="guide-grid">
        <div class="guide-item">
          <div class="guide-label">読むのが大変だった人</div>
          <div class="guide-action">単語数を減らす</div>
        </div>
        <div class="guide-item">
          <div class="guide-label">言葉が難しかった人</div>
          <div class="guide-action">難易度を下げる</div>
        </div>
        <div class="guide-item">
          <div class="guide-label">もっと読みたい人</div>
          <div class="guide-action">単語数を増やす</div>
        </div>
        <div class="guide-item">
          <div class="guide-label">言葉が簡単だった人</div>
          <div class="guide-action">難易度を上げる</div>
        </div>
      </div>

      <a href="${appBaseUrl}/settings" class="btn-settings">設定を変更する</a>
    </div>
  </div>
  <div class="footer">TapSmart English — tapsmart.jp</div>
</body>
</html>`;
}
