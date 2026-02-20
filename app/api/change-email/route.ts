import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminAuth } from "@/src/lib/firebaseClient";
import { Resend } from "resend";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signEmailChangeToken(payload: { uid: string; newEmail: string }) {
  const secret = process.env.READ_TOKEN_SECRET;
  if (!secret) throw new Error("READ_TOKEN_SECRET is not set");
  const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24時間有効
  const full = { ...payload, purpose: "email_change", exp };
  const body = base64url(JSON.stringify(full));
  const sig = crypto.createHmac("sha256", secret).update(body).digest();
  return `${body}.${base64url(sig)}`;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const body = await req.json().catch(() => ({}));
    const newEmail = (body.newEmail || "").trim().toLowerCase();
    if (!newEmail || !newEmail.includes("@")) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }

    // 現在のメールと同じかチェック
    const userRecord = await adminAuth.getUser(uid);
    if (userRecord.email?.toLowerCase() === newEmail) {
      return NextResponse.json({ ok: false, error: "same_email" }, { status: 400 });
    }

    // 新しいメールが既に使われていないかチェック
    try {
      await adminAuth.getUserByEmail(newEmail);
      return NextResponse.json({ ok: false, error: "email_in_use" }, { status: 409 });
    } catch (e: any) {
      if (e?.code !== "auth/user-not-found") {
        throw e;
      }
      // user-not-found = OK、使われていない
    }

    const token = signEmailChangeToken({ uid, newEmail });
    const baseUrl = process.env.APP_BASE_URL || "https://www.tapsmart.jp";
    const link = `${baseUrl}/api/apply-email-change?token=${encodeURIComponent(token)}`;

    const html = buildEmailChangeHtml(link, newEmail);

    await resend.emails.send({
      from: "TapSmart English <noreply@tapsmart.jp>",
      to: newEmail,
      subject: "【TapSmart English】メールアドレス変更の確認",
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[change-email] error:", e?.message);
    if (e?.message?.includes("TOO_MANY_ATTEMPTS") || e?.code === "auth/too-many-requests") {
      return NextResponse.json({ ok: false, error: "too_many_attempts" }, { status: 429 });
    }
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}

function buildEmailChangeHtml(link: string, newEmail: string): string {
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
              メールアドレス変更の確認
            </h1>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.8;color:#374151;text-align:center;">
              メールアドレスを <strong>${newEmail}</strong> に変更するリクエストを受け付けました。<br />
              以下のボタンをクリックして変更を確定してください。
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;padding:8px 0 28px;">
              <tr><td align="center" style="background:#2A3B6F;border-radius:10px;">
                <a href="${link}"
                   style="display:block;padding:14px 40px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">
                  メールアドレスを変更する
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
              このリクエストに心当たりがない場合は、このメールを無視してください。<br />
              リンクの有効期限は24時間です。
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
