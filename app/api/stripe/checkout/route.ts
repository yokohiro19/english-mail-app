import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { createHash } from "crypto";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebaseAdmin.server";
import { createRateLimiter, getClientIp } from "@/src/lib/rateLimit";

function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

const checkoutLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });


export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function getAppUrl(req: Request) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  if (!host) throw new Error("missing_host");
  return `${proto}://${host}`;
}

function clampTrialDays(v: any, fallback = 7) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n)); // 0 も許可（trialなし）
}

async function ensureUserDoc(params: { uid: string; email: string | null }) {
  const db = getAdminDb();
  const ref = db.collection("users").doc(params.uid);
  const snap = await ref.get();
  if (snap.exists) return { ref, user: snap.data() as any };

  // users を消しても復帰できるように最低限で作る
  const now = new Date();
  const base = {
    email: params.email ?? null,
    plan: "free",
    subscriptionStatus: "unknown",
    cancelAtPeriodEnd: false,
    trialUsed: false,
    level: 2,
    wordCount: 100,
    sendTime: "08:00",
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(base, { merge: true });
  const again = await ref.get();
  return { ref, user: again.data() as any };
}

async function ensureCustomerHasUid(params: {
  customerId: string;
  uid: string;
  email: string | null;
}) {
  // customer.metadata.uid を保証する（無ければ付与）
  const c = await stripe.customers.retrieve(params.customerId);
  if (typeof c === "object" && !("deleted" in c)) {
    const cur = (c.metadata as any)?.uid;
    if (cur !== params.uid) {
      await stripe.customers.update(params.customerId, {
        email: params.email ?? undefined,
        metadata: { ...(c.metadata ?? {}), uid: params.uid },
      });
    }
  }
}

export async function POST(req: Request) {
  try {
    const { ok: withinLimit } = checkoutLimiter.check(getClientIp(req));
    if (!withinLimit) {
      return NextResponse.json({ ok: false, error: "rate_limit_exceeded" }, { status: 429 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ ok: false, error: "missing_STRIPE_SECRET_KEY" }, { status: 500 });
    }
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return NextResponse.json({ ok: false, error: "missing_STRIPE_PRICE_ID" }, { status: 500 });
    }

    // ===== auth =====
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // ===== ensure users doc exists =====
    const decodedEmail = (decoded as any)?.email ?? null;
    const { ref: userRef, user } = await ensureUserDoc({ uid, email: decodedEmail });

    const email = (user?.email as string) ?? decodedEmail ?? null;
    const existingCustomerId = (user?.stripeCustomerId as string) ?? null;

    // ===== subscription duplicate guard（既存ロジックを維持）=====
    if (existingCustomerId) {
      const subs = await stripe.subscriptions.list({
        customer: existingCustomerId,
        status: "all",
        limit: 10,
      });

      const hasLiveSubscription = subs.data.some(
        (s) => s.status === "trialing" || s.status === "active"
      );

      if (hasLiveSubscription) {
        console.log("[stripe checkout] blocked duplicate subscription", {
          uid,
          customerId: existingCustomerId,
          subscriptions: subs.data.map((s) => ({
            id: s.id,
            status: s.status,
            cancel_at_period_end: s.cancel_at_period_end,
          })),
        });

        return NextResponse.json(
          {
            ok: false,
            code: "subscription_exists",
            error: "既に有効な契約があります。プラン変更・解約は管理画面から行ってください。",
          },
          { status: 400 }
        );
      }
    }

    // ===== body =====
    const ConsentSchema = z.object({
      agreedAt: z.string().optional(),
      termsVersion: z.string().optional(),
      privacyVersion: z.string().optional(),
      displayedTerms: z.array(z.string()).optional(),
    }).optional();

    const CheckoutBodySchema = z.object({
      trialDays: z.number().int().min(0).max(30).optional(),
      successPath: z.string().max(500).optional(),
      cancelPath: z.string().max(500).optional(),
      consent: ConsentSchema,
    });

    const rawBody = await req.json().catch(() => ({}));
    const parsed = CheckoutBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_request_body" }, { status: 400 });
    }
    const body = parsed.data;
    const consentData = body.consent;
    const requestedTrialDays = clampTrialDays(body.trialDays, 7);

    const successPath = body.successPath ?? "/billing?billing=success";
    const cancelPath = body.cancelPath ?? "/billing?billing=cancel";

    const appUrl = getAppUrl(req);
    const successUrl = `${appUrl}${successPath.startsWith("/") ? "" : "/"}${successPath}`;
    const cancelUrl = `${appUrl}${cancelPath.startsWith("/") ? "" : "/"}${cancelPath}`;

    // ★ trialUsed 判定 + トライアル残日数の計算
    let trialUsed = user?.trialUsed === true;

    // メールハッシュで過去のトライアル利用を照合（退会→再登録対策）
    if (!trialUsed && email) {
      const hash = hashEmail(email);
      const trialEmailSnap = await getAdminDb().collection("trialEmails").doc(hash).get();
      if (trialEmailSnap.exists) trialUsed = true;
    }
    let remainingTrialDays = 0;
    if (trialUsed) {
      const trialEndsAt = user?.trialEndsAt;
      if (trialEndsAt) {
        const endMs = trialEndsAt instanceof Date
          ? trialEndsAt.getTime()
          : typeof trialEndsAt?.toDate === "function"
            ? trialEndsAt.toDate().getTime()
            : new Date(trialEndsAt).getTime();
        if (Number.isFinite(endMs)) {
          const days = Math.ceil((endMs - Date.now()) / (24 * 60 * 60 * 1000));
          if (days > 0) remainingTrialDays = days;
        }
      }
    }

    // ===== 🔥ここが本命：customer を必ず確定して metadata.uid を刻む =====
    let customerId = existingCustomerId;

    if (customerId) {
      await ensureCustomerHasUid({ customerId, uid, email });
    } else {
      const created = await stripe.customers.create({
        email: email ?? undefined,
        metadata: { uid },
      });
      customerId = created.id;

      // Firestoreにも早めに保存（逆引きの足場）
      await userRef.set(
        {
          email: email ?? null,
          stripeCustomerId: customerId,
          updatedAt: new Date(),
        },
        { merge: true }
      );
    }

    // subscription_data（uidをsubscriptionにも刻む）
    // トライアル未使用 → フル日数、使用済みだが期間内 → 残日数で無料再開
    const effectiveTrialDays = !trialUsed ? requestedTrialDays : remainingTrialDays;
    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: { uid },
      ...(effectiveTrialDays > 0
        ? { trial_period_days: effectiveTrialDays }
        : {}),
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,

      // ★ ここも保険：Stripe側で追跡しやすい
      client_reference_id: uid,

      line_items: [{ price: priceId, quantity: 1 }],

      subscription_data: subscriptionData,
      metadata: { uid },

      // ★ customer_email は使わない。customer を固定する。
      customer: customerId,

      billing_address_collection: "auto",
      allow_promotion_codes: false,
    });

    // ===== 同意ログを保存（監査用） =====
    if (consentData) {
      const db = getAdminDb();
      const consentLogRef = db.collection("users").doc(uid).collection("consentLogs").doc();
      await consentLogRef.set({
        type: "checkout",
        sessionId: session.id,
        agreedAt: consentData.agreedAt ? new Date(consentData.agreedAt) : new Date(),
        termsVersion: consentData.termsVersion ?? null,
        privacyVersion: consentData.privacyVersion ?? null,
        displayedTerms: consentData.displayedTerms ?? [],
        planInfo: {
          priceId,
          price: 500,
          currency: "JPY",
          trialDays: effectiveTrialDays,
          autoRenewal: true,
        },
        createdAt: new Date(),
      }).catch((e) => {
        console.error("[consent log] failed to save:", e);
      });
    }

    return NextResponse.json({
      ok: true,
      url: session.url,
      trialApplied: !trialUsed && requestedTrialDays > 0,
      trialUsed,
      customerId, // デバッグ用（邪魔なら消してOK）
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}