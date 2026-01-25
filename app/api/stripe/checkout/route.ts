import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebaseAdmin.server";


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
    const body = await req.json().catch(() => ({}));
    const requestedTrialDays = clampTrialDays(body?.trialDays, 7);

    const successPath = String(body?.successPath ?? "/settings?billing=success");
    const cancelPath = String(body?.cancelPath ?? "/settings?billing=cancel");

    const appUrl = getAppUrl(req);
    const successUrl = `${appUrl}${successPath.startsWith("/") ? "" : "/"}${successPath}`;
    const cancelUrl = `${appUrl}${cancelPath.startsWith("/") ? "" : "/"}${cancelPath}`;

    // ★ trialUsed 判定（既存ロジック）
    const trialUsed = user?.trialUsed === true;

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
    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: { uid },
      ...(trialUsed
        ? {}
        : {
            trial_period_days: requestedTrialDays,
          }),
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

    return NextResponse.json({
      ok: true,
      url: session.url,
      trialApplied: !trialUsed && requestedTrialDays > 0,
      trialUsed,
      customerId, // デバッグ用（邪魔なら消してOK）
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown_error" }, { status: 400 });
  }
}