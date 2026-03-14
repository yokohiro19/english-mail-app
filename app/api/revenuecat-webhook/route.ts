import { NextResponse } from "next/server";
import { getAdminDb } from "@/src/lib/firebaseAdmin.server";

export const runtime = "nodejs";

type RCEventType =
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "CANCELLATION"
  | "UNCANCELLATION"
  | "EXPIRATION"
  | "BILLING_ISSUE"
  | "PRODUCT_CHANGE"
  | "TRANSFER"
  | "SUBSCRIPTION_PAUSED"
  | "SUBSCRIPTION_RESUMED"
  | "TEST";

interface RCEvent {
  type: RCEventType;
  app_user_id: string;
  original_app_user_id: string;
  aliases?: string[];
  expiration_at_ms?: number | null;
  grace_period_expiration_at_ms?: number | null;
  period_type?: "TRIAL" | "INTRO" | "NORMAL";
  is_trial_conversion?: boolean;
  store?: string;
  product_id?: string;
  entitlement_ids?: string[];
  cancel_reason?: string;
}

interface RCWebhookPayload {
  api_version: string;
  event: RCEvent;
}

export async function POST(req: Request) {
  // Verify webhook secret (set in RevenueCat dashboard → Webhooks → shared secret)
  const authHeader = req.headers.get("authorization") || "";
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: RCWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const event = payload?.event;
  if (!event?.type || !event?.app_user_id) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // app_user_id = Firebase UID (set via Purchases.logIn(uid) in the app)
  const uid = event.app_user_id;
  const db = getAdminDb();

  console.log(`[revenuecat-webhook] ${event.type} uid=${uid} store=${event.store ?? "?"}`);

  try {
    switch (event.type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "UNCANCELLATION":
      case "SUBSCRIPTION_RESUMED": {
        const isTrial = event.period_type === "TRIAL";
        const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
        await db.collection("users").doc(uid).set(
          {
            plan: "standard",
            subscriptionStatus: isTrial ? "trialing" : "active",
            cancelAtPeriodEnd: false,
            currentPeriodEnd: expiresAt,
            appleSubscriptionProductId: event.product_id ?? null,
            updatedAt: new Date(),
          },
          { merge: true }
        );
        break;
      }

      case "CANCELLATION": {
        // サブスクリプションはキャンセルされたが期間末まで有効
        const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
        await db.collection("users").doc(uid).set(
          {
            cancelAtPeriodEnd: true,
            currentPeriodEnd: expiresAt,
            updatedAt: new Date(),
          },
          { merge: true }
        );
        break;
      }

      case "EXPIRATION": {
        await db.collection("users").doc(uid).set(
          {
            plan: "free",
            subscriptionStatus: "expired",
            cancelAtPeriodEnd: false,
            updatedAt: new Date(),
          },
          { merge: true }
        );
        break;
      }

      case "BILLING_ISSUE": {
        // グレース期間中は継続、なければ停止
        const gracePeriodEnd = event.grace_period_expiration_at_ms
          ? new Date(event.grace_period_expiration_at_ms)
          : null;
        await db.collection("users").doc(uid).set(
          {
            plan: gracePeriodEnd ? "standard" : "free",
            subscriptionStatus: "past_due",
            updatedAt: new Date(),
          },
          { merge: true }
        );
        break;
      }

      case "SUBSCRIPTION_PAUSED": {
        await db.collection("users").doc(uid).set(
          {
            plan: "free",
            subscriptionStatus: "paused",
            updatedAt: new Date(),
          },
          { merge: true }
        );
        break;
      }

      case "TEST":
        console.log("[revenuecat-webhook] test event OK");
        break;

      default:
        console.log(`[revenuecat-webhook] unhandled: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[revenuecat-webhook] error:", err?.message);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }
}
