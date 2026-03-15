import { NextResponse } from "next/server";
import { getAdminAuth } from "@/src/lib/firebaseClient";
import { Resend } from "resend";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ ok: false, error: "missing_email" }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    const firebaseLink = await adminAuth.generatePasswordResetLink(email.trim());

    const oobCode = new URL(firebaseLink).searchParams.get("oobCode");
    const baseUrl = process.env.APP_BASE_URL || "https://english-mail-app.vercel.app";
    const link = `${baseUrl}/auth/reset-password?oobCode=${encodeURIComponent(oobCode!)}`;

    const html = buildResetHtml(link);

    await resend.emails.send({
      from: "TapSmart English <noreply@tapsmart.jp>",
      to: email.trim(),
      subject: "【TapSmart English】パスワードの再設定",
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = e?.errorInfo?.code || e?.code || "";
    if (code === "auth/user-not-found") {
      return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
    }
    if (code === "auth/invalid-email") {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }
    if (code === "auth/too-many-requests") {
      return NextResponse.json({ ok: false, error: "too_many_requests" }, { status: 429 });
    }
    console.error("[send-reset-password] error:", e?.message);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}

function buildResetHtml(link: string): string {
  return `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#F7F8FA;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FA;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1d1f42 0%,#2A3B6F 100%);padding:28px 32px;text-align:center;">
            <span style="font-family:'Outfit','Helvetica Neue',sans-serif;font-size:22px;font-weight:800;color:#ffffff;">
              TapSmart <span style="color:#4EFFF4;">English</span>
            </span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 20px;">
            <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#1d1f42;text-align:center;">
              パスワードの再設定
            </h1>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.8;color:#374151;text-align:center;">
              パスワード再設定のリクエストを受け付けました。<br />
              以下のボタンをクリックして、新しいパスワードを設定してください。
            </p>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;padding:8px 0 28px;">
              <tr><td align="center" style="background:#2A3B6F;border-radius:10px;">
                <a href="${link}"
                   style="display:block;padding:14px 40px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">
                  新しいパスワードを設定する
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
              このメールに心当たりがない場合は、このまま無視してください。<br />
              リンクの有効期限は1時間です。
            </p>
          </td>
        </tr>

        <!-- Footer -->
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
