import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getAdminDb } from "@/src/lib/firebaseClient";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { name, email, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ ok: false, error: "必須項目が入力されていません。" }, { status: 400 });
    }

    if (typeof name !== "string" || typeof email !== "string" || typeof message !== "string") {
      return NextResponse.json({ ok: false, error: "入力が不正です。" }, { status: 400 });
    }

    if (name.length > 200 || email.length > 320 || message.length > 5000) {
      return NextResponse.json({ ok: false, error: "入力が長すぎます。" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ ok: false, error: "メールアドレスの形式が正しくありません。" }, { status: 400 });
    }

    // Save to Firestore for audit/support purposes
    const db = getAdminDb();
    const contactLogRef = db.collection("contactLogs").doc();
    await contactLogRef.set({
      name,
      email,
      message,
      createdAt: new Date(),
      status: "pending", // pending -> replied -> resolved
    });

    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: "support@tapsmart.jp",
      replyTo: email,
      subject: `【お問い合わせ】${name}様より`,
      html: `
        <h2>お問い合わせ</h2>
        <p><strong>お名前:</strong> ${escapeHtml(name)}</p>
        <p><strong>メールアドレス:</strong> ${escapeHtml(email)}</p>
        <p><strong>ログID:</strong> ${contactLogRef.id}</p>
        <hr />
        <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("contact API error:", e);
    return NextResponse.json({ ok: false, error: "送信に失敗しました。" }, { status: 500 });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
