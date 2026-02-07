import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebaseClient";
import { Resend } from "resend";
import { signReadToken } from "@/src/lib/readToken";
import {
  mapExamToCEFR,
  pickRandomTopic,
  generateEmailContent,
  buildEmailHtml,
} from "@/src/lib/emailGenerator";
import { FieldValue } from "firebase-admin/firestore";

const resend = new Resend(process.env.RESEND_API_KEY);

function jstNow() {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60 * 1000);
}

function dateKeyFromJst(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function POST(req: Request) {
  try {
    // Auth
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token)
      return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // Env checks
    if (!process.env.OPENAI_API_KEY || !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !process.env.APP_BASE_URL || !process.env.READ_TOKEN_SECRET) {
      return NextResponse.json({ ok: false, error: "server_config_error" }, { status: 500 });
    }

    const db = getAdminDb();

    // Load user doc
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
    }

    const u = userSnap.data() as any;

    // Guard: already sent trial mail
    if (u.trialMailSentAt) {
      return NextResponse.json({ ok: false, error: "already_sent" }, { status: 400 });
    }

    // Guard: check if today's delivery already exists
    const nowJst = jstNow();
    const today = dateKeyFromJst(nowJst);
    const deliveryId = `${uid}_${today}`;
    const deliveryRef = db.collection("deliveries").doc(deliveryId);
    const deliverySnap = await deliveryRef.get();
    if (deliverySnap.exists) {
      return NextResponse.json({ ok: false, error: "already_delivered_today" }, { status: 400 });
    }

    // User settings
    const examType = (u.examType as string) ?? "TOEIC";
    const examLevel = (u.examLevel as string) ?? "TOEIC 500";
    const wordCount = Number(u.wordCount ?? 150);
    const cefr = mapExamToCEFR(examType, examLevel);

    // Determine email address
    const baseEmail = u.email as string;
    const email = (u.deliveryEmail && u.deliveryEmailVerified === true) ? u.deliveryEmail : baseEmail;
    if (!email) {
      return NextResponse.json({ ok: false, error: "no_email" }, { status: 400 });
    }

    // Reserve delivery
    await deliveryRef.set({
      uid,
      dateKey: today,
      status: "reserved",
      reservedAt: new Date(),
      isTrial: true,
    });

    // Generate content
    const topic = await pickRandomTopic(db);
    const out = await generateEmailContent(cefr, wordCount, topic);

    const subject = `TapSmart English - ${today.replaceAll("-", "/")}`;

    // Build read URL
    const readToken = signReadToken({ uid, dateKey: today, deliveryId }, 7);
    const readUrl = `${process.env.APP_BASE_URL}/api/read?t=${encodeURIComponent(readToken)}`;

    const html = buildEmailHtml({
      english: out.english_text,
      words: out.important_words,
      jp: out.japanese_translation,
      dateKey: today,
      readUrl,
      settingsUrl: `${process.env.APP_BASE_URL}/settings`,
    });

    // Send via Resend
    const sendRes = await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: email,
      subject,
      html,
      headers: { "Idempotency-Key": deliveryId },
    });

    // Update delivery doc
    await deliveryRef.set(
      {
        status: "sent",
        sentAt: new Date(),
        topicId: topic.id,
        cefr,
        emailProvider: "resend",
        emailId: (sendRes as any)?.data?.id ?? null,
      },
      { merge: true }
    );

    // Mark trial mail as sent
    await userRef.set(
      { trialMailSentAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[send-trial]", e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
