import { NextResponse } from "next/server";
import { getAdminDb } from "@/src/lib/firebaseClient";
import { createRateLimiter, getClientIp } from "@/src/lib/rateLimit";

const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5 });

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!limiter.check(ip).ok) {
    return NextResponse.json({ ok: false, error: "too_many_requests" }, { status: 429 });
  }

  let email: string;
  try {
    const body = await req.json();
    email = (body.email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  const db = getAdminDb();
  const snap = await db.collection("users").where("email", "==", email).limit(1).get();

  if (snap.empty) {
    // ユーザーが見つからない場合も成功を返す（メールアドレスの存在確認を防ぐ）
    return NextResponse.json({ ok: true });
  }

  await snap.docs[0].ref.set({ unsubscribed: true }, { merge: true });
  return NextResponse.json({ ok: true });
}
