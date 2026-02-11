import { NextResponse } from "next/server";
import { getAdminAuth } from "@/src/lib/firebaseClient";
import { Resend } from "resend";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const userRecord = await adminAuth.getUser(uid);

    if (userRecord.emailVerified) {
      return NextResponse.json({ ok: true, already: true });
    }

    const email = userRecord.email;
    if (!email) {
      return NextResponse.json({ ok: false, error: "no_email" }, { status: 400 });
    }

    console.log("[send-verification] generating link for", email);
    const link = await adminAuth.generateEmailVerificationLink(email);
    console.log("[send-verification] link generated ok");

    const html = buildVerificationHtml(link);

    const verifyFrom = "TapSmart English メールアドレス認証 <noreply@tapsmart.jp>";
    console.log("[send-verification] sending via Resend to", email, "from", verifyFrom);
    const sendResult = await resend.emails.send({
      from: verifyFrom,
      to: email,
      subject: "【TapSmart English】メールアドレスの確認",
      html,
    });
    console.log("[send-verification] send result:", JSON.stringify(sendResult));

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[send-verification] error:", e?.message, e?.code, JSON.stringify(e));
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}

function buildVerificationHtml(link: string): string {
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
              メールアドレスの確認
            </h1>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.8;color:#374151;text-align:center;">
              TapSmart English にご登録いただきありがとうございます。<br />
              以下のボタンをクリックして、メールアドレスを確認してください。
            </p>

            <!-- CTA Button -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" style="padding:8px 0 28px;">
                <a href="${link}"
                   style="display:inline-block;padding:14px 40px;background:#2A3B6F;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">
                  メールアドレスを確認する
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
