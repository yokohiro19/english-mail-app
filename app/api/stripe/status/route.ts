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

    const subId = user?.stripeSubscriptionId as string | undefined;
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

    const cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);
    const status = sub.status;
    const rawPeriodEnd = (sub as any).current_period_end;
    const currentPeriodEnd = typeof rawPeriodEnd === "number"
      ? new Date(rawPeriodEnd * 1000)
      : null;

    // Firestoreと差分があれば同期
    const firestoreCancelAtPeriodEnd = Boolean(user?.cancelAtPeriodEnd);
    const firestoreStatus = user?.subscriptionStatus ?? null;

    if (firestoreCancelAtPeriodEnd !== cancelAtPeriodEnd || firestoreStatus !== status) {
      const patch: any = {
        cancelAtPeriodEnd,
        subscriptionStatus: status,
        updatedAt: new Date(),
      };
      if (currentPeriodEnd) patch.currentPeriodEnd = currentPeriodEnd;
      await db.collection("users").doc(uid).set(patch, { merge: true });
    }

    return NextResponse.json({
      ok: true,
      synced: true,
      cancelAtPeriodEnd,
      subscriptionStatus: status,
      currentPeriodEnd: currentPeriodEnd?.toISOString() ?? null,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
