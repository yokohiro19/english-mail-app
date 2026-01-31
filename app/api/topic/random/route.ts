import { NextResponse } from "next/server";
import { getAdminDb } from "@/src/lib/firebaseClient";
import { createRateLimiter, getClientIp } from "@/src/lib/rateLimit";

const topicLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20 });

export async function GET(req: Request) {
  try {
    const { ok: withinLimit } = topicLimiter.check(getClientIp(req));
    if (!withinLimit) {
      return NextResponse.json({ ok: false, error: "rate_limit_exceeded" }, { status: 429 });
    }

    const db = getAdminDb();
    const r = Math.random();

    // rand >= r の先頭を取る
    let snap = await db
      .collection("topics")
      .where("rand", ">=", r)
      .orderBy("rand", "asc")
      .limit(1)
      .get();

    // 無ければ先頭に巻き戻し
    if (snap.empty) {
      snap = await db.collection("topics").orderBy("rand", "asc").limit(1).get();
    }

    if (snap.empty) {
      return NextResponse.json({ ok: false, error: "No topics found" }, { status: 404 });
    }

    const doc = snap.docs[0];
    const data = doc.data() as FirebaseFirestore.DocumentData;

    return NextResponse.json({
      ok: true,
      topic: {
        id: doc.id,
        category: data.category,
        title: data.title,
        promptSeed: data.promptSeed,
      },
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}