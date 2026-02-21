import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebaseAdmin.server";
import { getClientIp } from "@/src/lib/rateLimit";


export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function getAppUrl(req: Request) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
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

    const body = await req.json().catch(() => ({}));

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
    const returnUrl = `${appUrl}/routine`;

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    // ===== resume 同意ログを保存 =====
    const consentData = body?.consent;
    if (consentData) {
      const ipAddress = getClientIp(req);
      const now = new Date();
      const agreedAt = consentData.agreedAt ? new Date(consentData.agreedAt) : now;

      const consentLogRef = db.collection("users").doc(uid).collection("consentLogs").doc();
      await consentLogRef.set({
        type: "resume",
        agreedAt,
        termsVersion: consentData.termsVersion ?? null,
        privacyVersion: consentData.privacyVersion ?? null,
        displayedTerms: consentData.displayedTerms ?? [],
        ipAddress,
        createdAt: now,
      }).catch((e) => {
        console.error("[consent log resume] failed to save:", e);
      });

      await userRef.set({
        latestConsent: {
          type: "resume",
          agreedAt,
          termsVersion: consentData.termsVersion ?? null,
          privacyVersion: consentData.privacyVersion ?? null,
          ipAddress,
          createdAt: now,
        },
      }, { merge: true }).catch((e) => {
        console.error("[latestConsent resume] failed to save:", e);
      });
    }

    return NextResponse.json({ ok: true, url: portal.url });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
