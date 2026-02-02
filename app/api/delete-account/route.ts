import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebaseClient";
import Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token)
      return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const db = getAdminDb();
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const u = userSnap.exists ? (userSnap.data() as any) : null;

    // 1. Stripe サブスクリプションをキャンセル
    if (u?.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(u.stripeSubscriptionId);
      } catch (e: any) {
        // 既にキャンセル済み等のエラーは無視
        console.error("[delete-account] stripe cancel error:", e?.message);
      }
    }

    // 2. Firestore ユーザードキュメントを論理削除（個人情報を消去、統計データは保持）
    if (userSnap.exists) {
      await userRef.set(
        {
          // 個人情報を消去
          email: FieldValue.delete(),
          nickname: FieldValue.delete(),
          deliveryEmail: FieldValue.delete(),
          deliveryEmailVerified: FieldValue.delete(),
          stripeCustomerId: FieldValue.delete(),
          stripeSubscriptionId: FieldValue.delete(),

          // 状態を更新
          plan: "free",
          subscriptionStatus: "canceled",
          disabled: true,
          deletedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    // 3. Firebase Auth ユーザーを削除
    await adminAuth.deleteUser(uid);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[delete-account]", e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
