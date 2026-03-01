import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createHash } from "crypto";
import { getAdminDb } from "@/src/lib/firebaseAdmin.server";
import { createRateLimiter, getClientIp } from "@/src/lib/rateLimit";

function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

async function recordTrialEmail(uid: string): Promise<void> {
  try {
    const db = getAdminDb();
    const userSnap = await db.collection("users").doc(uid).get();
    const email = userSnap.data()?.email as string | undefined;
    if (!email) return;
    const hash = hashEmail(email);
    await db.collection("trialEmails").doc(hash).set({ usedAt: new Date() }, { merge: true });
  } catch (e: any) {
    console.error("[trialEmails] failed to record:", e?.message);
  }
}

const webhookLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 100 });

export const runtime = "nodejs";

// apiVersionは固定しない（Stripeアカウントのデフォルトに従う）
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/** current_period_end を取得（新API: items.data[0] / 旧API: subscription直下） */
function getCurrentPeriodEnd(sub: any): number | null {
  // 旧APIバージョン: subscription直下
  if (typeof sub?.current_period_end === "number") return sub.current_period_end;
  // 新APIバージョン: items.data[0] に移動
  const item = sub?.items?.data?.[0];
  if (typeof item?.current_period_end === "number") return item.current_period_end;
  return null;
}

function getUidFromMetadata(obj: any): string | null {
  const uid = obj?.metadata?.uid;
  return typeof uid === "string" && uid.length > 0 ? uid : null;
}

/**
 * Invoice オブジェクトから subscription ID を抽出する
 * Stripe SDK v20 / API 2025+ では invoice.subscription が string でなくなる場合がある
 * 複数のフィールドパスを試みる
 */
function extractSubIdFromInvoice(invoice: any): string | null {
  // 旧 API: invoice.subscription が string ID
  if (typeof invoice?.subscription === "string" && invoice.subscription.length > 0) {
    return invoice.subscription;
  }
  // 展開済みオブジェクト: invoice.subscription.id
  if (typeof invoice?.subscription?.id === "string") {
    return invoice.subscription.id;
  }
  // 新 API (2025+): invoice.subscription_details.subscription
  if (typeof invoice?.subscription_details?.subscription === "string") {
    return invoice.subscription_details.subscription;
  }
  // 新 API (2025+): invoice.parent.subscription_details.subscription
  if (typeof invoice?.parent?.subscription_details?.subscription === "string") {
    return invoice.parent.subscription_details.subscription;
  }
  // フォールバック: 取れなかった場合はデバッグログを残す
  console.warn("[stripe webhook] extractSubIdFromInvoice: could not extract subId", {
    subscriptionType: typeof invoice?.subscription,
    subscriptionValue: JSON.stringify(invoice?.subscription)?.slice(0, 100),
    hasSubscriptionDetails: !!invoice?.subscription_details,
    hasParent: !!invoice?.parent,
  });
  return null;
}

/**
 * Firestoreの users を Stripe IDs から逆引きして uid を取る
 * - stripeSubscriptionId があればそれ優先
 * - 無ければ stripeCustomerId で探す
 */
async function findUidByStripeIds(params: {
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
}): Promise<string | null> {
  const db = getAdminDb();
  const { stripeSubscriptionId, stripeCustomerId } = params;

  if (stripeSubscriptionId) {
    const snap = await db
      .collection("users")
      .where("stripeSubscriptionId", "==", stripeSubscriptionId)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].id;
  }

  if (stripeCustomerId) {
    const snap = await db
      .collection("users")
      .where("stripeCustomerId", "==", stripeCustomerId)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].id;
  }

  return null;
}

/**
 * Stripe Customer を retrieve して metadata.uid を取る（救済ルート）
 */
async function findUidFromCustomer(customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  try {
    const c: any = await stripe.customers.retrieve(customerId);
    if (c?.deleted === true) return null;
    return getUidFromMetadata(c);
  } catch {
    return null;
  }
}

/**
 * Stripeの Subscription から Firestore に書き込むパッチを作る
 * 要件：
 * - trialing で cancel_at_period_end=true なら plan は即 free（＝配信停止）
 * - active で cancel_at_period_end=true なら plan は standard のまま（期間末までOK）
 * - trialing になったら trialUsed=true を永久に立てる
 */
function buildPatchFromSubscription(sub: any, fallbackUid?: string | null) {
  const status: string | undefined = sub?.status;

  const cancelAtPeriodEnd: boolean = Boolean(sub?.cancel_at_period_end);
  const cancelAt: number | null = typeof sub?.cancel_at === "number" ? sub.cancel_at : null;
  const canceledAt: number | null = typeof sub?.canceled_at === "number" ? sub.canceled_at : null;

  // 「キャンセル予約が入っている」を広めに判定
  const hasCancellationScheduled = cancelAtPeriodEnd || cancelAt !== null || canceledAt !== null;

  const metaUid = getUidFromMetadata(sub);
  const uid = metaUid ?? fallbackUid ?? null;

  const patch: any = {
    subscriptionStatus: status ?? null,
    cancelAtPeriodEnd: hasCancellationScheduled,
    updatedAt: new Date(),
  };

  // 終了日: cancel_at > current_period_end の優先順位
  if (cancelAt !== null) {
    patch.currentPeriodEnd = new Date(cancelAt * 1000);
  } else {
    const periodEnd = getCurrentPeriodEnd(sub);
    if (periodEnd !== null) {
      patch.currentPeriodEnd = new Date(periodEnd * 1000);
    }
  }

  if (typeof sub?.trial_end === "number") {
    patch.trialEndsAt = new Date(sub.trial_end * 1000);
  }

  if (status === "trialing") {
    patch.trialUsed = true;
    patch.trialStartedAt = new Date();
  }

  // plan 判定（現仕様：activeは期間末までstandard）
  if (status === "trialing") {
    patch.plan = hasCancellationScheduled ? "free" : "standard";
  } else if (status === "active") {
    patch.plan = "standard";
  } else {
    patch.plan = "free";
  }

  return { uid, patch, status, cancelAtPeriodEnd: hasCancellationScheduled };
}

/**
 * 🔒 Firestore上の「正サブスクID」と一致しないイベントを無視するためのヘルパー
 * - uid が分かった後に呼ぶ
 * - currentSubId があり、eventSubId と違うなら true（= 無視）
 */
async function shouldIgnoreNonCurrentSubscriptionEvent(params: { uid: string; eventSubId: string | null }) {
  const db = getAdminDb();
  const { uid, eventSubId } = params;

  if (!eventSubId) return false;

  const userSnap = await db.collection("users").doc(uid).get();
  const user = userSnap.exists ? (userSnap.data() as any) : null;
  const currentSubId = typeof user?.stripeSubscriptionId === "string" ? user.stripeSubscriptionId : null;

  // currentSubId が未設定の時は「初回紐付け」フェーズなので無視しない
  if (!currentSubId) return false;

  // 異なる sub のイベントは無視（trial残骸等の汚染防止）
  return currentSubId !== eventSubId;
}

/**
 * ===== Phase6 5.2: Ops logging (Stripe webhook) =====
 * - event.id をキーに1行ログ（重複は上書きでOK）
 * - 監視ログの失敗でWebhookが落ちないようにする
 */
function toJstString(d: Date) {
  return d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}
function nowIso() {
  return toJstString(new Date());
}
function toIsoFromUnixSeconds(sec: number | null | undefined) {
  if (typeof sec !== "number") return null;
  const d = new Date(sec * 1000);
  return Number.isNaN(d.getTime()) ? null : toJstString(d);
}
function pickCommonIdsFromEvent(event: Stripe.Event) {
  const obj: any = event.data?.object as any;
  const type = event.type;

  let subId: string | null = null;
  let customerId: string | null = null;

  if (type === "checkout.session.completed") {
    subId = typeof obj?.subscription === "string" ? obj.subscription : null;
    customerId = typeof obj?.customer === "string" ? obj.customer : null;
  } else if (type.startsWith("customer.subscription.")) {
    subId = typeof obj?.id === "string" ? obj.id : null;
    customerId = typeof obj?.customer === "string" ? obj.customer : null;
  } else if (type.startsWith("invoice.")) {
    subId = extractSubIdFromInvoice(obj);

    customerId =
      typeof obj?.customer === "string"
        ? obj.customer
        : typeof obj?.customer?.id === "string"
          ? obj.customer.id
          : null;
  }

  const metaUid = getUidFromMetadata(obj) ?? null;
  return { subId, customerId, metaUid };
}

async function safeUpsertOpsStripeEvent(params: {
  event: Stripe.Event;
  uid?: string | null;
  subId?: string | null;
  customerId?: string | null;
  outcome: "applied" | "ignored" | "skipped" | "no_uid" | "no_sub" | "noop";
  note?: string | null;
  extra?: Record<string, any> | null;
}) {
  try {
    const db = getAdminDb();
    const { event, uid, subId, customerId, outcome, note, extra } = params;

    await db.collection("opsStripeEvents").doc(event.id).set(
      {
        eventId: event.id,
        type: event.type,
        created: typeof (event as any)?.created === "number" ? (event as any).created : null,
        createdAtIso: toIsoFromUnixSeconds(typeof (event as any)?.created === "number" ? (event as any).created : null),
        livemode: Boolean((event as any)?.livemode),
        apiVersion: (event as any)?.api_version ?? null,
        requestId: (event as any)?.request?.id ?? null,

        uid: uid ?? null,
        stripeSubscriptionId: subId ?? null,
        stripeCustomerId: customerId ?? null,

        outcome,
        note: note ?? null,
        extra: extra ?? null,

        receivedAtIso: nowIso(),
      },
      { merge: true }
    );

  } catch (e: any) {
    console.error("[opsStripeEvents] write failed:", e?.message ?? e);
    console.error("[opsStripeEvents] code:", e?.code);
    console.error("[opsStripeEvents] details:", e?.details);


    console.error("[opsStripeEvents] full:", e);


  }
}

async function safeWriteOpsStripeError(params: {
  eventId: string;
  type: string;
  uid?: string | null;
  subId?: string | null;
  customerId?: string | null;
  error: any;
}) {
  try {
    const db = getAdminDb();
    const { eventId, type, uid, subId, customerId, error } = params;

    const message =
      typeof error?.message === "string" ? error.message : typeof error === "string" ? error : "unknown_error";

    await db.collection("opsStripeWebhookErrors").doc(eventId).set(
      {
        eventId,
        type,
        uid: uid ?? null,
        stripeSubscriptionId: subId ?? null,
        stripeCustomerId: customerId ?? null,
        message,
        name: error?.name ?? null,
        stack: typeof error?.stack === "string" ? String(error.stack).slice(0, 5000) : null,
        createdAtIso: nowIso(),
      },
      { merge: true }
    );
  } catch (e) {
    console.error("[opsStripeWebhookErrors] write failed:", e);
  }
}

/**
 * Subscription event を共通処理（created/updated）
 * - truth を retrieve
 * - uid を複数ルートで解決
 * - 非currentを無視
 * - users を update
 * - ops log を残す
 */
async function handleSubscriptionUpsert(event: Stripe.Event) {
  const raw = event.data.object as any;
  const subId = typeof raw?.id === "string" ? raw.id : null;
  const customerId = typeof raw?.customer === "string" ? raw.customer : null;

  if (!subId) {
    await safeUpsertOpsStripeEvent({
      event,
      uid: getUidFromMetadata(raw),
      subId,
      customerId,
      outcome: "no_sub",
      note: "subscription event missing subId",
      extra: null,
    });
    return;
  }

  // truth を取りに行く（payload薄い対策）
  const truth: any = await stripe.subscriptions.retrieve(subId);
  if (truth?.deleted === true) {
    await safeUpsertOpsStripeEvent({
      event,
      uid: null,
      subId,
      customerId,
      outcome: "skipped",
      note: "truth subscription.deleted=true",
      extra: null,
    });
    return;
  }

  // uid解決（強化版）
  let uid: string | null =
    getUidFromMetadata(truth) ??
    getUidFromMetadata(raw) ??
    (await findUidFromCustomer(customerId)) ??
    (await findUidByStripeIds({ stripeSubscriptionId: subId, stripeCustomerId: customerId }));

  if (!uid) {
    await safeUpsertOpsStripeEvent({
      event,
      uid: null,
      subId,
      customerId,
      outcome: "no_uid",
      note: "cannot resolve uid (sub/customer/firestore)",
      extra: { truthStatus: truth?.status ?? null },
    });
    return;
  }

  // 🔒 非current subscription のイベントなら無視
  const ignore = await shouldIgnoreNonCurrentSubscriptionEvent({ uid, eventSubId: subId });
  if (ignore) {
    console.log("[stripe webhook] ignored non-current subscription event", {
      uid,
      eventSubId: subId,
      truthStatus: truth?.status ?? null,
    });

    await safeUpsertOpsStripeEvent({
      event,
      uid,
      subId,
      customerId,
      outcome: "ignored",
      note: `ignored non-current ${event.type}`,
      extra: { truthStatus: truth?.status ?? null },
    });
    return;
  }

  const built = buildPatchFromSubscription(truth, uid);

  const db = getAdminDb();

  // standardStartedAt: 初めて standard に変わった日時を記録（1回のみ）
  const mergePatch: any = {
    ...built.patch,
    stripeCustomerId: customerId ?? null,
    stripeSubscriptionId: subId,
    updatedAt: new Date(),
  };

  if (built.patch.plan === "standard") {
    const existingDoc = await db.collection("users").doc(uid).get();
    const existing = existingDoc.data() as any;
    if (!existing?.standardStartedAt) {
      mergePatch.standardStartedAt = new Date();
    }
  }

  await db.collection("users").doc(uid).set(mergePatch, { merge: true });

  // トライアル開始時にメールハッシュを記録（退会→再登録のトライアル重複防止）
  if (built.status === "trialing") {
    await recordTrialEmail(uid);
  }

  await safeUpsertOpsStripeEvent({
    event,
    uid,
    subId,
    customerId,
    outcome: "applied",
    note: `${event.type} applied`,
    extra: {
      status: truth?.status ?? null,
      cancel_at_period_end: Boolean(truth?.cancel_at_period_end),
      cancel_at: typeof truth?.cancel_at === "number" ? truth.cancel_at : null,
      canceled_at: typeof truth?.canceled_at === "number" ? truth.canceled_at : null,
      trial_end: typeof truth?.trial_end === "number" ? truth.trial_end : null,
      current_period_end: getCurrentPeriodEnd(truth),
    },
  });

  // トライアル中にキャンセル予約が入った場合、即時キャンセルする
  if (truth?.status === "trialing" && Boolean(truth?.cancel_at_period_end) && subId) {
    try {
      await stripe.subscriptions.cancel(subId);
      console.log("[stripe webhook] immediately cancelled trialing subscription", { uid, subId });
    } catch (cancelErr: any) {
      console.error("[stripe webhook] failed to immediately cancel trialing sub:", cancelErr?.message);
    }
  }
}

/**
 * invoice.paid / invoice.payment_succeeded 共通処理
 */
async function handleInvoicePaidLike(event: Stripe.Event) {
  const invoice = event.data.object as any;

  const stripeSubscriptionId = extractSubIdFromInvoice(invoice);

  const stripeCustomerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : typeof invoice.customer?.id === "string"
        ? invoice.customer.id
        : null;

  // uid解決
  let uid: string | null =
    (await findUidByStripeIds({ stripeSubscriptionId, stripeCustomerId })) ??
    (await findUidFromCustomer(stripeCustomerId));

  if (!uid) {
    console.log(`[stripe webhook] ${event.type}: user_not_found`, {
      stripeSubscriptionId,
      stripeCustomerId,
    });

    await safeUpsertOpsStripeEvent({
      event,
      uid: null,
      subId: stripeSubscriptionId,
      customerId: stripeCustomerId,
      outcome: "no_uid",
      note: `${event.type} user_not_found`,
      extra: null,
    });
    return;
  }

  // 🔒 非currentなら無視
  const ignore = await shouldIgnoreNonCurrentSubscriptionEvent({
    uid,
    eventSubId: stripeSubscriptionId,
  });
  if (ignore) {
    console.log(`[stripe webhook] ignored non-current ${event.type}`, {
      uid,
      eventSubId: stripeSubscriptionId,
    });

    await safeUpsertOpsStripeEvent({
      event,
      uid,
      subId: stripeSubscriptionId,
      customerId: stripeCustomerId,
      outcome: "ignored",
      note: `ignored non-current ${event.type}`,
      extra: null,
    });
    return;
  }

  // サブスクリプションを取得して完全なデータを書き込む
  const patch: any = {
    plan: "standard",
    subscriptionStatus: "active",
    updatedAt: new Date(),
  };

  if (stripeSubscriptionId) {
    patch.stripeSubscriptionId = stripeSubscriptionId;
    try {
      const sub: any = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const periodEnd = getCurrentPeriodEnd(sub);
      if (periodEnd !== null) {
        patch.currentPeriodEnd = new Date(periodEnd * 1000);
      }
    } catch {}
  }
  if (stripeCustomerId) {
    patch.stripeCustomerId = stripeCustomerId;
  }

  const db = getAdminDb();
  await db.collection("users").doc(uid).set(patch, { merge: true });

  await safeUpsertOpsStripeEvent({
    event,
    uid,
    subId: stripeSubscriptionId,
    customerId: stripeCustomerId,
    outcome: "applied",
    note: `${event.type} applied`,
    extra: null,
  });
}

export async function POST(req: Request) {
  const { ok: withinLimit } = webhookLimiter.check(getClientIp(req));
  if (!withinLimit) {
    return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "missing_STRIPE_SECRET_KEY" }, { status: 500 });
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "missing_STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return NextResponse.json(
      { error: "webhook_signature_verification_failed" },
      { status: 400 }
    );
  }

  // ===== debug logs（ユーザー指定）=====
  console.log("[stripe webhook]", event.type);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    console.log("session.subscription", (session as any).subscription);
  }
  if (event.type.startsWith("customer.subscription.")) {
    const sub = event.data.object as Stripe.Subscription;
    console.log("sub.status", sub.status, "sub.metadata.uid", (sub as any).metadata?.uid);
  }
  // ================================

  const { subId: guessedSubId, customerId: guessedCustomerId, metaUid } = pickCommonIdsFromEvent(event);

  try {
    switch (event.type) {
      /**
       * Checkout完了（サブスク作成直後）
       * → subscription を retrieve して metadata.uid を見に行く
       * ※ここだけは「正サブスクIDをセットする」ので、非current無視はしない
       */
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const subscriptionId =
          typeof (session as any).subscription === "string" ? (session as any).subscription : null;
        const customerId = typeof session.customer === "string" ? session.customer : null;

        if (!subscriptionId || !customerId) {
          await safeUpsertOpsStripeEvent({
            event,
            uid: metaUid ?? null,
            subId: subscriptionId,
            customerId,
            outcome: "no_sub",
            note: "checkout.session.completed missing subscriptionId/customerId",
            extra: null,
          });
          break;
        }

        const subscription: any = await stripe.subscriptions.retrieve(subscriptionId);
        if (subscription?.deleted === true) {
          await safeUpsertOpsStripeEvent({
            event,
            uid: metaUid ?? null,
            subId: subscriptionId,
            customerId,
            outcome: "skipped",
            note: "subscription.deleted=true",
            extra: null,
          });
          break;
        }

        // uid解決（強化：customer metadataも見る）
        const uid =
          getUidFromMetadata(subscription) ??
          (await findUidFromCustomer(customerId)) ??
          (await findUidByStripeIds({ stripeSubscriptionId: subscriptionId, stripeCustomerId: customerId }));

        if (!uid) {
          await safeUpsertOpsStripeEvent({
            event,
            uid: null,
            subId: subscriptionId,
            customerId,
            outcome: "no_uid",
            note: "cannot resolve uid in checkout.session.completed",
            extra: { status: subscription?.status ?? null },
          });
          break;
        }

        const { patch } = buildPatchFromSubscription(subscription, uid);

        const db = getAdminDb();

        const checkoutMergePatch: any = {
          ...patch,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription?.id ?? subscriptionId,
          updatedAt: new Date(),
        };

        // standardStartedAt: 初めて standard に変わった日時を記録（1回のみ）
        if (patch.plan === "standard") {
          const existingDoc = await db.collection("users").doc(uid).get();
          const existing = existingDoc.data() as any;
          if (!existing?.standardStartedAt) {
            checkoutMergePatch.standardStartedAt = new Date();
          }
        }

        await db.collection("users").doc(uid).set(checkoutMergePatch, { merge: true });

        // トライアル開始時にメールハッシュを記録
        if (subscription?.status === "trialing") {
          await recordTrialEmail(uid);
        }

        await safeUpsertOpsStripeEvent({
          event,
          uid,
          subId: subscriptionId,
          customerId,
          outcome: "applied",
          note: "checkout.session.completed applied",
          extra: {
            status: subscription?.status ?? null,
            cancel_at_period_end: Boolean(subscription?.cancel_at_period_end),
            trial_end: typeof subscription?.trial_end === "number" ? subscription.trial_end : null,
            current_period_end: getCurrentPeriodEnd(subscription),
          },
        });

        break;
      }

      /**
       * created を追加：未対応だったのが今回の原因
       */
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await handleSubscriptionUpsert(event);
        break;
      }

      /**
       * 明示削除（たまに来る）
       * → 🔒 正サブスク以外なら無視
       */
      case "customer.subscription.deleted": {
        const raw = event.data.object as any;
        const subId = typeof raw?.id === "string" ? raw.id : null;
        const customerId = typeof raw?.customer === "string" ? raw.customer : null;

        // uid解決（強化）
        let uid: string | null =
          getUidFromMetadata(raw) ??
          (await findUidFromCustomer(customerId)) ??
          (await findUidByStripeIds({ stripeSubscriptionId: subId, stripeCustomerId: customerId }));

        if (!uid) {
          await safeUpsertOpsStripeEvent({
            event,
            uid: null,
            subId,
            customerId,
            outcome: "no_uid",
            note: "cannot resolve uid for subscription.deleted",
            extra: null,
          });
          break;
        }

        const ignore = await shouldIgnoreNonCurrentSubscriptionEvent({ uid, eventSubId: subId });
        if (ignore) {
          console.log("[stripe webhook] ignored non-current subscription.deleted", {
            uid,
            eventSubId: subId,
          });

          await safeUpsertOpsStripeEvent({
            event,
            uid,
            subId,
            customerId,
            outcome: "ignored",
            note: "ignored non-current subscription.deleted",
            extra: null,
          });
          break;
        }

        const db = getAdminDb();
        await db.collection("users").doc(uid).set(
          {
            plan: "free",
            subscriptionStatus: raw?.status ?? "canceled",
            cancelAtPeriodEnd: false,
            updatedAt: new Date(),
          },
          { merge: true }
        );

        await safeUpsertOpsStripeEvent({
          event,
          uid,
          subId,
          customerId,
          outcome: "applied",
          note: "subscription.deleted applied",
          extra: { status: raw?.status ?? "canceled" },
        });

        break;
      }

      /**
       * 支払い失敗
       */
      case "invoice.payment_failed": {
        const invoice = event.data.object as any;

        const stripeSubscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : typeof invoice.subscription?.id === "string"
              ? invoice.subscription.id
              : null;

        const stripeCustomerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : typeof invoice.customer?.id === "string"
              ? invoice.customer.id
              : null;

        let uid: string | null =
          (await findUidByStripeIds({ stripeSubscriptionId, stripeCustomerId })) ??
          (await findUidFromCustomer(stripeCustomerId));

        if (!uid) {
          console.log("[stripe webhook] invoice.payment_failed: user_not_found", {
            stripeSubscriptionId,
            stripeCustomerId,
          });

          await safeUpsertOpsStripeEvent({
            event,
            uid: null,
            subId: stripeSubscriptionId,
            customerId: stripeCustomerId,
            outcome: "no_uid",
            note: "invoice.payment_failed user_not_found",
            extra: null,
          });
          break;
        }

        const ignore = await shouldIgnoreNonCurrentSubscriptionEvent({
          uid,
          eventSubId: stripeSubscriptionId,
        });
        if (ignore) {
          console.log("[stripe webhook] ignored non-current invoice.payment_failed", {
            uid,
            eventSubId: stripeSubscriptionId,
          });

          await safeUpsertOpsStripeEvent({
            event,
            uid,
            subId: stripeSubscriptionId,
            customerId: stripeCustomerId,
            outcome: "ignored",
            note: "ignored non-current invoice.payment_failed",
            extra: null,
          });
          break;
        }

        const db = getAdminDb();
        await db.collection("users").doc(uid).set(
          {
            plan: "free",
            subscriptionStatus: "past_due",
            updatedAt: new Date(),
          },
          { merge: true }
        );

        await safeUpsertOpsStripeEvent({
          event,
          uid,
          subId: stripeSubscriptionId,
          customerId: stripeCustomerId,
          outcome: "applied",
          note: "invoice.payment_failed applied",
          extra: null,
        });

        break;
      }

      /**
       * 支払い成功（揺れ対策で2つ拾う）
       */
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        await handleInvoicePaidLike(event);
        break;
      }

      default: {
        // 未対応イベントは noop としてログだけ残す
        await safeUpsertOpsStripeEvent({
          event,
          uid: metaUid ?? null,
          subId: guessedSubId ?? null,
          customerId: guessedCustomerId ?? null,
          outcome: "noop",
          note: "unhandled event type (noop)",
          extra: null,
        });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    await safeWriteOpsStripeError({
      eventId: event.id,
      type: event.type,
      uid: metaUid ?? null,
      subId: guessedSubId ?? null,
      customerId: guessedCustomerId ?? null,
      error: err,
    });

    await safeUpsertOpsStripeEvent({
      event,
      uid: metaUid ?? null,
      subId: guessedSubId ?? null,
      customerId: guessedCustomerId ?? null,
      outcome: "skipped",
      note: `handler_error: ${err?.message ?? "unknown_error"}`,
      extra: null,
    });

    return NextResponse.json({ error: "webhook_handler_failed" }, { status: 500 });
  }
}