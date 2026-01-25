import { NextResponse } from "next/server";
import { getAdminDb } from "@/src/lib/firebaseClient";

export async function GET() {
  try {
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
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}