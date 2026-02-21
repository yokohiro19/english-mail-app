import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebaseClient";
import { createRateLimiter, getClientIp } from "@/src/lib/rateLimit";
import { resolveCEFR, buildSystemPrompt } from "@/src/lib/emailGenerator";

const generateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5 });

const OutputSchema = z.object({
  english_text: z.string(),
  important_words: z.array(
    z.object({
      word: z.string(),
      meaning: z.string(),
    })
  ),
  japanese_translation: z.string(),
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function pickRandomTopic() {
  const db = getAdminDb();
  const snap = await db.collection("topics").select("category", "promptSeed").get();
  if (snap.empty) throw new Error("No topics found.");

  const idx = Math.floor(Math.random() * snap.size);
  const doc = snap.docs[idx];
  const data = doc.data() as any;
  return { id: doc.id, category: data.category, promptSeed: data.promptSeed };
}

export async function POST(req: Request) {
  try {
    const { ok: withinLimit } = generateLimiter.check(getClientIp(req));
    if (!withinLimit) {
      return NextResponse.json({ ok: false, error: "rate_limit_exceeded" }, { status: 429 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ ok: false, error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    // 1) Firebase ID token を受け取る
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing auth token" }, { status: 401 });
    }

    // 2) Adminで検証
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // 3) ユーザー設定取得
    const db = getAdminDb();
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ ok: false, error: "User settings not found" }, { status: 404 });
    }

    const u = userSnap.data() as any;
    const wordCount = Number(u.wordCount ?? 150);
    const cefr = resolveCEFR(u);
    const topic = await pickRandomTopic();

    // 4) プロンプト（CEFRレベル別の詳細ガイドライン）
    const system = buildSystemPrompt(cefr);

    const userPrompt = [
      `CEFR: ${cefr}`,
      `Target word count: about ${wordCount} words (not characters).`,
      `Topic category: ${topic.category}`,
      `Topic: ${topic.promptSeed}`,
      "",
      "Generate JSON fields:",
      `- english_text: email-like text (~${wordCount} words)`,
      "- important_words: 6-10 important words from the text with Japanese meanings",
      "- japanese_translation: full Japanese translation of english_text",
    ].join("\n");

    // 5) Structured Outputs（Zod）で壊れないJSON
    const response = await openai.responses.parse({
      // ガイドの例でも responses.parse + zodTextFormat が示されている :contentReference[oaicite:2]{index=2}
      // Structured Outputs対応モデルの説明あり :contentReference[oaicite:3]{index=3}
      model: "gpt-4o-mini-2024-07-18",
      input: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      text: {
        format: zodTextFormat(OutputSchema, "english_email"),
      },
    });

    return NextResponse.json({
      ok: true,
      topic,
      cefr,
      result: response.output_parsed,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}