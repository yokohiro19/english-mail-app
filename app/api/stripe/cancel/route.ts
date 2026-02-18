import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebaseAdmin.server";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
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
      return NextResponse.json({ ok: false, error: "no_subscription" }, { status: 400 });
    }

    const sub = await stripe.subscriptions.retrieve(subId);
    if (sub.status !== "trialing") {
      return NextResponse.json({ ok: false, error: "not_trialing" }, { status: 400 });
    }

    await stripe.subscriptions.cancel(subId);

    await db.collection("users").doc(uid).set(
      {
        plan: "free",
        subscriptionStatus: "canceled",
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
