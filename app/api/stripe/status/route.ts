import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebaseAdmin.server";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ ok: false, error: "missing_STRIPE_SECRET_KEY" }, { status: 500 });
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });

    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const db = getAdminDb();
    const userSnap = await db.collection("users").doc(uid).get();
    const user = userSnap.exists ? (userSnap.data() as any) : null;

    let subId = user?.stripeSubscriptionId as string | undefined;

    // stripeSubscriptionId が未設定の場合、stripeCustomerId からアクティブなサブスクを検索
    if (!subId && user?.stripeCustomerId) {
      try {
        const subs = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: "active",
          limit: 1,
        });
        if (subs.data.length > 0) {
          subId = subs.data[0].id;
          // Firestoreにも保存して次回以降は直接取得
          await db.collection("users").doc(uid).set(
            { stripeSubscriptionId: subId, updatedAt: new Date() },
            { merge: true }
          );
        } else {
          // trialing もチェック
          const trialSubs = await stripe.subscriptions.list({
            customer: user.stripeCustomerId,
            status: "trialing",
            limit: 1,
          });
          if (trialSubs.data.length > 0) {
            subId = trialSubs.data[0].id;
            await db.collection("users").doc(uid).set(
              { stripeSubscriptionId: subId, updatedAt: new Date() },
              { merge: true }
            );
          }
        }
      } catch {}
    }

    if (!subId) {
      return NextResponse.json({ ok: true, synced: false, reason: "no_subscription" });
    }

    let sub: Stripe.Subscription;
    try {
      sub = await stripe.subscriptions.retrieve(subId);
    } catch {
      return NextResponse.json({ ok: true, synced: false, reason: "retrieve_failed" });
    }

    if ((sub as any).deleted) {
      return NextResponse.json({ ok: true, synced: false, reason: "deleted" });
    }

    // cancel_at_period_end または cancel_at のどちらかで解約予約を判定
    const rawCancelAt = (sub as any).cancel_at;
    const cancelScheduled = Boolean(sub.cancel_at_period_end) || (typeof rawCancelAt === "number" && rawCancelAt > 0);

    const status = sub.status;

    // 終了日: cancel_at > current_period_end の優先順位で取得
    const endTimestamp = typeof rawCancelAt === "number" && rawCancelAt > 0
      ? rawCancelAt
      : typeof (sub as any).current_period_end === "number"
        ? (sub as any).current_period_end
        : null;
    const currentPeriodEnd = typeof endTimestamp === "number"
      ? new Date(endTimestamp * 1000)
      : null;

    // Firestoreと差分があれば同期（currentPeriodEnd も常にチェック）
    const firestoreCancelAtPeriodEnd = Boolean(user?.cancelAtPeriodEnd);
    const firestoreStatus = user?.subscriptionStatus ?? null;
    const firestoreCurrentPeriodEnd = user?.currentPeriodEnd ?? null;
    const hasCurrentPeriodEndDiff = currentPeriodEnd && !firestoreCurrentPeriodEnd;

    if (firestoreCancelAtPeriodEnd !== cancelScheduled || firestoreStatus !== status || hasCurrentPeriodEndDiff) {
      const patch: any = {
        cancelAtPeriodEnd: cancelScheduled,
        subscriptionStatus: status,
        updatedAt: new Date(),
      };
      if (currentPeriodEnd) patch.currentPeriodEnd = currentPeriodEnd;
      await db.collection("users").doc(uid).set(patch, { merge: true });
    }

    return NextResponse.json({
      ok: true,
      synced: true,
      cancelAtPeriodEnd: cancelScheduled,
      subscriptionStatus: status,
      currentPeriodEnd: currentPeriodEnd?.toISOString() ?? null,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
