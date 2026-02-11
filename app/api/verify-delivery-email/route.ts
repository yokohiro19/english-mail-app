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

    const db = getAdminDb();

    // ログインアドレスと同じなら認証メール不要で即確定
    if (email === decoded.email) {
      await db.collection("users").doc(uid).set({
        deliveryEmail: email,
        deliveryEmailVerified: true,
        deliveryEmailToken: null,
        deliveryEmailTokenAt: null,
      }, { merge: true });
      return NextResponse.json({ ok: true, autoVerified: true });
    }

    const verifyToken = crypto.randomBytes(32).toString("hex");

    await db.collection("users").doc(uid).set({
      deliveryEmail: email,
      deliveryEmailVerified: false,
      deliveryEmailToken: verifyToken,
      deliveryEmailTokenAt: new Date(),
    }, { merge: true });

    const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || process.env.APP_BASE_URL || "https://tapsmart.jp";
    const verifyUrl = `${baseUrl}/api/verify-delivery-email?token=${verifyToken}&uid=${uid}`;

    await resend.emails.send({
      from: "TapSmart English メールアドレス認証 <noreply@tapsmart.jp>",
      to: email,
      subject: "【TapSmart English】配信先メールアドレスの認証",
      html: buildDeliveryVerifyHtml(verifyUrl),
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

function buildDeliveryVerifyHtml(link: string): string {
  return `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#F7F8FA;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FA;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:linear-gradient(135deg,#1d1f42 0%,#2A3B6F 100%);padding:28px 32px;text-align:center;">
            <span style="font-family:'Outfit','Helvetica Neue',sans-serif;font-size:22px;font-weight:800;color:#ffffff;">
              TapSmart <span style="color:#4EFFF4;">English</span>
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 20px;">
            <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#1d1f42;text-align:center;">
              配信先メールアドレスの認証
            </h1>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.8;color:#374151;text-align:center;">
              以下のボタンをクリックして、<br />配信先メールアドレスを認証してください。
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" style="padding:8px 0 28px;">
                <a href="${link}"
                   style="display:inline-block;padding:14px 40px;background:#2A3B6F;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">
                  認証する
                </a>
              </td></tr>
            </table>
            <p style="margin:0 0 8px;font-size:12px;line-height:1.7;color:#9CA3AF;text-align:center;">
              ボタンがクリックできない場合は、以下のURLをブラウザに貼り付けてください。
            </p>
            <p style="margin:0 0 24px;font-size:11px;line-height:1.6;color:#9CA3AF;word-break:break-all;text-align:center;">
              ${link}
            </p>
            <hr style="border:none;border-top:1px solid #F3F4F6;margin:0 0 20px;" />
            <p style="margin:0;font-size:12px;line-height:1.7;color:#9CA3AF;text-align:center;">
              このメールに心当たりがない場合は、このまま無視してください。
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 28px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9CA3AF;">
              &copy; 2026 TapSmart English
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
