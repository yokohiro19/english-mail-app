import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebaseClient";
import { Resend } from "resend";
import { safeCompare } from "@/src/lib/safeCompare";
import { signReadToken } from "@/src/lib/readToken";
import { mapExamToCEFR, pickRandomTopic, generateEmailContent, buildEmailHtml } from "@/src/lib/emailGenerator";

export const runtime = "nodejs";
export const preferredRegion = "hnd1";
export const maxDuration = 120;

const resend = new Resend(process.env.RESEND_API_KEY);

// ===== JST utils =====
function jstNow() {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60 * 1000);
}
function hhmm(d: Date) {
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
function dateKey(d: Date) {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}
function hhmmListForLastMinutes(nowJst: Date, minutes = 5) {
  // 例: minutes=5 なら [now, now-1, ... now-4] を HH:MM にしてユニーク化
  const set = new Set<string>();
  for (let i = 0; i < minutes; i++) {
    const d = new Date(nowJst.getTime() - i * 60 * 1000);
    set.add(hhmm(d));
  }
  return Array.from(set);
}

// ===== Billing guard =====
type Plan = "free" | "standard";
type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
  | "unknown";

function normalizePlan(v: any): Plan {
  return v === "standard" ? "standard" : "free";
}
function normalizeStatus(v: any): SubscriptionStatus {
  const s = typeof v === "string" ? v : "";
  const allowed: SubscriptionStatus[] = [
    "trialing",
    "active",
    "past_due",
    "canceled",
    "unpaid",
    "incomplete",
    "incomplete_expired",
    "paused",
  ];
  return (allowed.includes(s as any) ? (s as any) : "unknown") as SubscriptionStatus;
}

/**
 * 送信許可ルール：
 * - plan が standard 以外は送らない
 * - status は trialing / active だけ送る
 * - それ以外は送らない（安全側）
 */
function canSendByBilling(plan: Plan, status: SubscriptionStatus, trialEndsAt?: Date | null) {
  if (plan !== "standard") return { ok: false, reason: `plan_${plan}` };
  if (status === "active") return { ok: true, reason: "status_active" };
  if (status === "trialing") {
    if (trialEndsAt && trialEndsAt.getTime() < Date.now()) {
      return { ok: false, reason: "trial_expired" };
    }
    return { ok: true, reason: "status_trialing" };
  }
  return { ok: false, reason: `status_${status}` };
}

// mapExamToCEFR, pickRandomTopic, generateEmailContent, buildEmailHtml are in @/src/lib/emailGenerator
// signReadToken is in @/src/lib/readToken

/**
 * ===== Phase6: Ops log helpers =====
 */
function opsRunId(dateKey: string, hhmm: string) {
  return `${dateKey}_${hhmm.replace(":", "-")}`;
}

async function safeWriteOpsCronRun(params: {
  dateKey: string;
  targetHHMM: string;
  attempted: number;
  sent: number;
  skipped: { noEmail: number; alreadySent: number; billing: number; disabled: number; unverified: number; paused: number };
  billingSkipReasons: Record<string, number>;
  errorsCount: number;
  durationMs: number;
}) {
  try {
    const db = getAdminDb();
    const id = opsRunId(params.dateKey, params.targetHHMM);

    await db.collection("opsCronRuns").doc(id).set(
      {
        runId: id,
        dateKey: params.dateKey,
        targetHHMM: params.targetHHMM,
        attempted: params.attempted,
        sent: params.sent,
        skipped: params.skipped,
        billingSkipReasons: params.billingSkipReasons,
        errorsCount: params.errorsCount,
        durationMs: params.durationMs,
        ranAt: new Date(),
      },
      { merge: true }
    );
  } catch (e) {
    console.error("[opsCronRuns] write failed:", e);
  }
}

export async function GET(req: Request) {
  const startedAt = Date.now();

  try {
    // Cron保護（Authorization: Bearer ヘッダーのみ受付）
    const authHeader = req.headers.get("authorization") ?? "";
    const secret = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!process.env.CRON_SECRET || !safeCompare(secret, process.env.CRON_SECRET)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // env checks
    if (!process.env.OPENAI_API_KEY)
      return NextResponse.json({ ok: false, error: "Missing OPENAI_API_KEY" }, { status: 500 });
    if (!process.env.RESEND_API_KEY)
      return NextResponse.json({ ok: false, error: "Missing RESEND_API_KEY" }, { status: 500 });
    if (!process.env.EMAIL_FROM)
      return NextResponse.json({ ok: false, error: "Missing EMAIL_FROM" }, { status: 500 });
    if (!process.env.APP_BASE_URL)
      return NextResponse.json({ ok: false, error: "Missing APP_BASE_URL" }, { status: 500 });
    if (!process.env.READ_TOKEN_SECRET)
      return NextResponse.json({ ok: false, error: "Missing READ_TOKEN_SECRET" }, { status: 500 });

    const db = getAdminDb();

    const nowJst = jstNow();
    const targetHHMM = hhmm(nowJst);
    const today = dateKey(nowJst);

    // ✅ 直近5分のsendTimeを対象にする（Cron遅延に強い）
    const windowHHMM = hhmmListForLastMinutes(nowJst, 5);
    const usersSnap = await db.collection("users").where("sendTime", "in", windowHHMM).get();

    let attempted = 0;
    let sent = 0;

    let skippedNoEmail = 0;
    let skippedAlreadySent = 0;
    let skippedBilling = 0;
    let skippedDisabled = 0;
    let skippedUnverified = 0;
    let skippedPaused = 0;

    const billingSkipReasons: Record<string, number> = {};

    const errors: any[] = [];
    const billingSkips: Array<{ uid: string; plan: string; status: string; reason: string }> = [];

    for (const uDoc of usersSnap.docs) {
      attempted++;
      const u = uDoc.data() as any;
      const uid = uDoc.id;
      const baseEmail = u.email as string;
      const email = (u.deliveryEmail && u.deliveryEmailVerified === true) ? u.deliveryEmail : baseEmail;

      if (!email) {
        skippedNoEmail++;
        continue;
      }

      if (u.disabled === true) {
        skippedDisabled++;
        continue;
      }

      // ===== Delivery Pause Guard =====
      if (u.deliveryPaused === true) {
        skippedPaused++;
        continue;
      }

      // ===== Email Verification Guard =====
      try {
        const adminAuth = getAdminAuth();
        const authUser = await adminAuth.getUser(uid);
        if (!authUser.emailVerified) {
          skippedUnverified++;
          continue;
        }
      } catch {
        skippedUnverified++;
        continue;
      }

      // ===== Billing Guard =====
      const plan = normalizePlan(u.plan);
      const status = normalizeStatus(u.subscriptionStatus);
      const rawTrialEndsAt = u.trialEndsAt;
      const trialEndsAt: Date | null =
        rawTrialEndsAt instanceof Date ? rawTrialEndsAt :
        typeof rawTrialEndsAt?.toDate === "function" ? rawTrialEndsAt.toDate() :
        rawTrialEndsAt ? new Date(rawTrialEndsAt) : null;
      const gate = canSendByBilling(plan, status, trialEndsAt);

      if (!gate.ok) {
        skippedBilling++;
        billingSkipReasons[gate.reason] = (billingSkipReasons[gate.reason] ?? 0) + 1;
        billingSkips.push({ uid, plan, status, reason: gate.reason });
        continue;
      }

      // ===== delivery lock (transaction) =====
      const deliveryId = `${uid}_${today}`;
      const deliveryRef = db.collection("deliveries").doc(deliveryId);

      // ✅ ここで “予約” を取れた人だけ送る（同時実行でも二重送信しない）
      const reserved = await db.runTransaction(async (tx) => {
        const snap = await tx.get(deliveryRef);
        if (snap.exists) return false;

        tx.set(deliveryRef, {
          uid,
          dateKey: today,
          status: "reserved",
          reservedAt: new Date(),
        });
        return true;
      });

      if (!reserved) {
        skippedAlreadySent++;
        continue;
      }

      try {
        const examType = (u.examType as string) ?? "TOEIC";
        const examLevel = (u.examLevel as string) ?? "TOEIC 500";
        const wordCount = Number(u.wordCount ?? 150);
        const cefr = mapExamToCEFR(examType, examLevel);

        const topic = await pickRandomTopic(db);
        const out = await generateEmailContent(cefr, wordCount, topic);
        const subject = `TapSmart English (${today}) - ${topic.category}`.replace(/[\r\n]/g, "");

        // ✅ 読んだURL（署名付き）
        const token = signReadToken({ uid, dateKey: today, deliveryId }, 7);
        const readUrl = `${process.env.APP_BASE_URL}/api/read?t=${encodeURIComponent(token)}`;

        const html = buildEmailHtml({
          english: out.english_text,
          words: out.important_words,
          jp: out.japanese_translation,
          dateKey: today,
          readUrl,
        });

        const sendRes = await resend.emails.send({
          from: process.env.EMAIL_FROM!,
          to: email,
          subject,
          html,
          headers: { "Idempotency-Key": deliveryId },
        });

        // ✅ “予約済み” を “sent” に更新（reservedAtなどを保持）
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

        sent++;
      } catch (err: any) {
        console.error(err);
        errors.push({ uid, error: err?.message ?? String(err) });

        // ✅ 失敗も deliveries に残す（運用で原因追跡できる）
        try {
          await deliveryRef.set(
            {
              status: "error",
              errorMessage: err?.message ?? String(err),
              errorAt: new Date(),
            },
            { merge: true }
          );
        } catch (e) {
          console.error("[deliveries] write error state failed:", e);
        }
      }
    }

    const billingSkipsSample = billingSkips.slice(0, 50);
    const durationMs = Date.now() - startedAt;

    await safeWriteOpsCronRun({
      dateKey: today,
      targetHHMM: targetHHMM, // opsRunIdはこの“実行時刻”をキーにする
      attempted,
      sent,
      skipped: {
        noEmail: skippedNoEmail,
        alreadySent: skippedAlreadySent,
        billing: skippedBilling,
        disabled: skippedDisabled,
        unverified: skippedUnverified,
        paused: skippedPaused,
      },
      billingSkipReasons,
      errorsCount: errors.length,
      durationMs,
    });

    return NextResponse.json({
      ok: true,
      targetHHMM,
      windowHHMM, // ✅ 追加：どの時間帯を対象にしたか分かる
      dateKey: today,
      attempted,
      sent,
      durationMs,
      skipped: {
        noEmail: skippedNoEmail,
        alreadySent: skippedAlreadySent,
        billing: skippedBilling,
        disabled: skippedDisabled,
        unverified: skippedUnverified,
        paused: skippedPaused,
      },
      billingSkipReasons,
      billingSkips: billingSkipsSample,
      errors,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}