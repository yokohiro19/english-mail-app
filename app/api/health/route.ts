import { NextResponse } from "next/server";
import { getAdminDb } from "@/src/lib/firebaseAdmin.server";

export const runtime = "nodejs";

function hasEnv(name: string) {
  const v = process.env[name];
  return typeof v === "string" && v.length > 0;
}

/**
 * health を公開したくないので secret で保護する
 * - ?secret=CRON_SECRET と一致したら詳細を返す
 * - 一致しなければ 404（存在を隠す）
 */
function isAuthorized(req: Request) {
  const url = new URL(req.url);
  const given = url.searchParams.get("secret") ?? "";
  const expected = process.env.CRON_SECRET ?? "";
  return expected.length > 0 && given.length > 0 && given === expected;
}

export async function GET(req: Request) {
  // 🔒 未認証は 404（存在隠し）
  if (!isAuthorized(req)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const startedAt = Date.now();

  // 必須ENV（あなたのプロジェクトに合わせて調整）
  const requiredEnv = [
    "FIREBASE_SERVICE_ACCOUNT_KEY",
    "APP_BASE_URL",

    // Stripe
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    // "STRIPE_PRICE_ID", // 使ってるならON

    // Email / AI
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "OPENAI_API_KEY",

    // Cron / read token
    "CRON_SECRET",
    "READ_TOKEN_SECRET",
  ] as const;

  const env = Object.fromEntries(requiredEnv.map((k) => [k, hasEnv(k)])) as Record<string, boolean>;
  const envOk = Object.values(env).every(Boolean);

  const checks: Record<string, { ok: boolean; ms?: number; error?: string }> = {};

  // Firestore（Admin SDK）疎通：write 1回（opsHealth）
  try {
    const t0 = Date.now();
    const db = getAdminDb();

    await db.collection("opsHealth").doc("latest").set(
      {
        at: new Date(),
        atIso: new Date().toISOString(),
      },
      { merge: true }
    );

    checks.firestore = { ok: true, ms: Date.now() - t0 };
  } catch (e: any) {
    checks.firestore = { ok: false, error: e?.message ?? String(e) };
  }

  const ok = envOk && checks.firestore?.ok === true;

  return NextResponse.json({
    ok,
    ts: new Date().toISOString(),
    env,
    checks,
    durationMs: Date.now() - startedAt,
  });
}