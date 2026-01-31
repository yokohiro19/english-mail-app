import { NextResponse } from "next/server";
import { getAdminDb } from "@/src/lib/firebaseAdmin.server";
import { safeCompare } from "@/src/lib/safeCompare";

export const runtime = "nodejs";

function isAuthed(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  // ここは「簡易版」：ログインユーザー制限にしたい場合は後で強化する
  // まずは CRON_SECRET と同じ方式で守る（最短）
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return !!process.env.CRON_SECRET && safeCompare(token, process.env.CRON_SECRET);
}

export async function GET(req: Request) {
  if (!isAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);

  const db = getAdminDb();

  const snap = await db
    .collection("opsCronRuns")
    .orderBy("ranAt", "desc")
    .limit(limit)
    .get();

  const items = snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      runId: data.runId ?? d.id,
      dateKey: data.dateKey,
      targetHHMM: data.targetHHMM,
      attempted: data.attempted ?? 0,
      sent: data.sent ?? 0,
      skipped: data.skipped ?? {},
      errorsCount: data.errorsCount ?? 0,
      durationMs: data.durationMs ?? 0,
      billingSkipReasons: data.billingSkipReasons ?? {},
      ranAt: data.ranAt?.toDate?.()?.toISOString?.() ?? null,
    };
  });

  return NextResponse.json({ ok: true, items });
}