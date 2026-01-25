import { NextResponse } from "next/server";
import { getAdminDb } from "@/src/lib/firebaseClient";
import { verifyReadToken } from "@/src/lib/readToken";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("t");
    if (!token) return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });

    const payload = verifyReadToken(token);
    const { uid, dateKey, deliveryId } = payload;

    const db = getAdminDb();

    // deliveries 参照（存在確認 + topicId/cefrを引っ張る）
    const deliveryRef = db.collection("deliveries").doc(deliveryId);
    const deliverySnap = await deliveryRef.get();
    if (!deliverySnap.exists) {
      // delivery が無いならログも作らない（攻撃/ミスを吸収）
      return NextResponse.json({ ok: false, error: "delivery_not_found" }, { status: 404 });
    }

    const delivery = deliverySnap.data() as any;

    const logId = `${uid}_${dateKey}`;
    const logRef = db.collection("studyLogs").doc(logId);

    // ✅ 冪等：最初の read なら firstReadAt を作り、以後は lastReadAt/readCount だけ更新
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(logRef);
      if (!snap.exists) {
        tx.set(logRef, {
          uid,
          dateKey,
          deliveryId,
          topicId: delivery.topicId ?? null,
          cefr: delivery.cefr ?? null,
          firstReadAt: FieldValue.serverTimestamp(),
          lastReadAt: FieldValue.serverTimestamp(),
          readCount: 1,
          userAgent: req.headers.get("user-agent") ?? null,
        });
      } else {
        tx.update(logRef, {
          lastReadAt: FieldValue.serverTimestamp(),
          readCount: FieldValue.increment(1),
        });
      }
    });

    // UX：そのままJSONでもいいが、メールから押した時はHTMLの方が気持ちいい
    const html = `
      <html><body style="font-family: ui-sans-serif, system-ui; padding: 24px;">
        <h2>✅ 記録しました</h2>
        <p>今日の学習を「読んだ」として保存しました。</p>
        <p style="color:#666">date: ${dateKey}</p>
        <a href="/settings" style="display:inline-block;margin-top:16px;">設定へ戻る</a>
      </body></html>
    `;
    return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown_error" }, { status: 400 });
  }
}