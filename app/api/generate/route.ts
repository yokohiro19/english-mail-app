import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebaseClient";

type ExamType = "TOEIC" | "EIKEN" | "TOEFL";

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

function mapExamToCEFR(examType: ExamType, examLevel: string): string {
  // あなたの確定マッピング（必要なら後で微調整）
  // 例: "TOEIC 600", "英検 2級", "TOEFL 80"
  const normalized = examLevel.replace(/\s+/g, " ").trim();
  const key = `${examType} ${normalized}`;

  const map: Record<string, string> = {
    "TOEIC TOEIC 400": "A2",
    "TOEIC TOEIC 500": "B1-",
    "TOEIC TOEIC 600": "B1",
    "TOEIC TOEIC 700": "B2",
    "TOEIC TOEIC 800": "B2+",
    "TOEIC TOEIC 900": "C1",
    "TOEIC TOEIC 990": "C2",
    "EIKEN 英検 2級": "B1",
    "EIKEN 英検 準1級": "C1",
    "EIKEN 英検 1級": "C2",
    "TOEFL TOEFL 40": "A2",
    "TOEFL TOEFL 60": "B1",
    "TOEFL TOEFL 80": "B2",
    "TOEFL TOEFL 100": "C1",
    "TOEFL TOEFL 110+": "C2",
  };

  return map[key] ?? "B1";
}

async function pickRandomTopic() {
  const db = getAdminDb();
  const r = Math.random();

  let snap = await db
    .collection("topics")
    .where("rand", ">=", r)
    .orderBy("rand", "asc")
    .limit(1)
    .get();

  if (snap.empty) {
    snap = await db.collection("topics").orderBy("rand", "asc").limit(1).get();
  }

  if (snap.empty) throw new Error("No topics found.");

  const doc = snap.docs[0];
  const data = doc.data() as any;

  return {
    id: doc.id,
    category: data.category,
    title: data.title,
    promptSeed: data.promptSeed,
  };
}

export async function POST(req: Request) {
  try {
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
    const examType = (u.examType as ExamType) ?? "TOEIC";
    const examLevel = (u.examLevel as string) ?? "TOEIC 500";
    const wordCount = Number(u.wordCount ?? 150);

    const cefr = mapExamToCEFR(examType, examLevel);
    const topic = await pickRandomTopic();

    // 4) プロンプト（CEFRだけ渡す設計）
    const system = [
      "You are an English writing tutor who creates short study emails.",
      "Return output as JSON that strictly matches the schema.",
      "Difficulty MUST follow CEFR level only (A2/B1/B2/C1/C2).",
      "For A2–B1: keep sentences short, avoid complex subordinate clauses, minimize idioms, avoid abstract discussion.",
      "The email must be practical and natural, like a short work email.",
    ].join("\n");

    const userPrompt = [
      `CEFR: ${cefr}`,
      `Target word count: about ${wordCount} words (not characters).`,
      `Topic category: ${topic.category}`,
      `Topic title: ${topic.title}`,
      `Topic details: ${topic.promptSeed}`,
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
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}