import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebaseAdmin.server";


export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function normalizeUrl(raw?: string | null) {
  return raw ? raw.replace(/\/$/, "") : null;
}

function isLocalhostUrl(url: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url);
}

function getAppUrl(req: Request) {
  const appBaseUrl = normalizeUrl(process.env.APP_BASE_URL);
  const vercelUrl = normalizeUrl(
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
  );

  if (appBaseUrl && !(process.env.VERCEL && isLocalhostUrl(appBaseUrl))) {
    return appBaseUrl;
  }
  if (process.env.VERCEL && vercelUrl) return vercelUrl;

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  if (!host) throw new Error("missing_host");
  return `${proto}://${host}`;
}

async function ensureCustomerHasUid(customerId: string, uid: string) {
  try {
    const c: any = await stripe.customers.retrieve(customerId);
    if (c?.deleted === true) return;

    const current = c?.metadata?.uid;
    if (current === uid) return;

    await stripe.customers.update(customerId, {
      metadata: { ...(c?.metadata ?? {}), uid },
    });
  } catch (e) {
    // Portal自体は開けた方がいいので、ここで落とさない
    console.error("[stripe portal] ensureCustomerHasUid failed", e);
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ ok: false, error: "missing_STRIPE_SECRET_KEY" }, { status: 500 });
    }

    // ===== auth =====
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // ===== load user =====
    const db = getAdminDb();
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const user = userSnap.exists ? (userSnap.data() as any) : null;

    const customerId = (user?.stripeCustomerId as string) ?? null;
    if (!customerId) {
      return NextResponse.json({ ok: false, error: "missing_stripeCustomerId" }, { status: 400 });
    }

    // ✅ Portalを開く前に customer.metadata.uid を保証
    await ensureCustomerHasUid(customerId, uid);

    const appUrl = getAppUrl(req);
    const returnUrl = `${appUrl}/settings`;

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ ok: true, url: portal.url });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
