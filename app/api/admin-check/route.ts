import { NextResponse } from "next/server";
import { getAdminApp, getAdminDb } from "@/src/lib/firebaseClient";

export async function GET(req: Request) {
  try {
    // 1) 簡易認証（これがないと危険）
    const secret = req.headers.get("x-admin-check-secret");
    if (!process.env.ADMIN_CHECK_SECRET || secret !== process.env.ADMIN_CHECK_SECRET) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // 2) Admin SDK 初期化チェック
    const app = getAdminApp();

    // 3) Firestore 接続チェック（listCollections は読み取り権限が必要）
    const db = getAdminDb();
    const cols = await db.listCollections();
    const colIds = cols.map((c) => c.id);

    return NextResponse.json({
      ok: true,
      adminAppName: app.name,
      projectId: app.options.projectId ?? null,
      collections: colIds,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? "Admin check failed",
      },
      { status: 500 }
    );
  }
}
