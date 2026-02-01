import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebaseClient";
import { Resend } from "resend";
import crypto from "crypto";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

// POST: Send verification email
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { email } = (await req.json()) as { email?: string };
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }

    const verifyToken = crypto.randomBytes(32).toString("hex");
    const db = getAdminDb();

    await db.collection("users").doc(uid).set({
      deliveryEmail: email,
      deliveryEmailVerified: false,
      deliveryEmailToken: verifyToken,
      deliveryEmailTokenAt: new Date(),
    }, { merge: true });

    const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || process.env.APP_BASE_URL || "https://tapsmart.jp";
    const verifyUrl = `${baseUrl}/api/verify-delivery-email?token=${verifyToken}&uid=${uid}`;

    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: email,
      subject: "【TapSmart English】配信先メールアドレスの認証",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1d1f42;">メールアドレスの認証</h2>
          <p>以下のボタンをクリックして、配信先メールアドレスを認証してください。</p>
          <a href="${verifyUrl}" style="display: inline-block; background: #4EFFF4; color: #1d1f42; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; margin: 16px 0;">認証する</a>
          <p style="color: #6B7280; font-size: 13px; margin-top: 24px;">このメールに心当たりがない場合は無視してください。</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("verify-delivery-email POST error:", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

// GET: Verify token from email link
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const uid = searchParams.get("uid");

  if (!token || !uid) {
    return new NextResponse(htmlPage("認証に失敗しました", "無効なリンクです。"), { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  try {
    const db = getAdminDb();
    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();

    if (!snap.exists) {
      return new NextResponse(htmlPage("認証に失敗しました", "ユーザーが見つかりません。"), { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    const data = snap.data() as any;
    if (data.deliveryEmailToken !== token) {
      return new NextResponse(htmlPage("認証に失敗しました", "トークンが無効または期限切れです。"), { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    await userRef.update({
      deliveryEmailVerified: true,
      deliveryEmailToken: null,
      deliveryEmailTokenAt: null,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || process.env.APP_BASE_URL || "https://tapsmart.jp";
    return new NextResponse(htmlPage("認証が完了しました", `配信先メールアドレス（${data.deliveryEmail}）が認証されました。`, `${baseUrl}/settings`), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (e: any) {
    console.error("verify-delivery-email GET error:", e);
    return new NextResponse(htmlPage("エラーが発生しました", "しばらくしてから再度お試しください。"), { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

function htmlPage(title: string, message: string, redirectUrl?: string) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} - TapSmart English</title>
  ${redirectUrl ? `<meta http-equiv="refresh" content="3;url=${redirectUrl}" />` : ""}
  <style>
    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #F5F7FA; color: #1d1f42; }
    .card { background: #fff; padding: 40px; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); text-align: center; max-width: 400px; }
    h1 { font-size: 24px; margin-bottom: 12px; }
    p { color: #6B7280; font-size: 15px; }
    a { color: #1d1f42; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    ${redirectUrl ? `<p style="margin-top:16px;"><a href="${redirectUrl}">設定ページに戻る</a></p>` : ""}
  </div>
</body>
</html>`;
}
