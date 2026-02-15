import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

export const OutputSchema = z.object({
  english_text: z.string(),
  important_words: z.array(z.object({ word: z.string(), meaning: z.string() })),
  japanese_translation: z.string(),
});

export function mapLevelToCEFR(level: number): string {
  const map: Record<number, string> = {
    1: "A2",
    2: "B1-",
    3: "B1",
    4: "B2",
    5: "C1",
  };
  return map[level] ?? "B1-";
}

export function resolveCEFR(u: { level?: number; examType?: string; examLevel?: string }): string {
  if (typeof u.level === "number") return mapLevelToCEFR(u.level);
  return mapExamToCEFR(u.examType ?? "TOEIC", u.examLevel ?? "TOEIC 500");
}

export function mapExamToCEFR(examType: string, examLevel: string): string {
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

export async function pickRandomTopic(db: FirebaseFirestore.Firestore) {
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
  return { id: doc.id, category: data.category, title: data.title, promptSeed: data.promptSeed };
}

export async function generateEmailContent(
  cefr: string,
  wordCount: number,
  topic: { category: string; title: string; promptSeed: string },
) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const system = [
    "You are creating English learning material for Japanese learners.",
    "Your task is to generate a complete, ready-to-read English email text that requires NO editing or filling in by the reader.",
    "NEVER use placeholders like [Your Name], [Company], [Date], [Recipient], etc. Instead, use realistic fictional names and details.",
    "Email signatures MUST only contain a fictional name and job title (2 lines max). NEVER include company names, email addresses, phone numbers, URLs, or physical addresses in signatures.",
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

  const resp = await openai.responses.parse({
    model: "gpt-4o-mini-2024-07-18",
    input: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
    text: { format: zodTextFormat(OutputSchema, "english_email") },
  });

  return resp.output_parsed!;
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildEmailHtml(payload: {
  english: string;
  words: { word: string; meaning: string }[];
  jp: string;
  dateKey: string;
  readUrl: string;
  upgradeUrl?: string;
  settingsUrl?: string;
}) {
  const wordsHtml = payload.words
    .map(
      (w) =>
        `<tr><td style="padding:6px 12px 6px 0;font-weight:700;color:#1d1f42;white-space:nowrap;vertical-align:top">${escapeHtml(w.word)}</td><td style="padding:6px 0;color:#374151">${escapeHtml(w.meaning)}</td></tr>`
    )
    .join("");

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Inter',sans-serif;line-height:1.7;color:#1d1f42;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #E8EAED;border-radius:12px">
    <!-- Header -->
    <div style="background:#1d1f42;padding:20px 28px;border-radius:12px 12px 0 0">
      <span style="font-size:20px;font-weight:800;letter-spacing:0.5px"><span style="color:#ffffff">TapSmart</span> <span style="color:#4EFFF4">English</span></span>
      <span style="font-size:13px;color:rgba(255,255,255,0.5);margin-left:12px">${payload.dateKey}</span>
    </div>

    <div style="padding:28px">
      <!-- English -->
      <div style="margin-bottom:28px">
        <h3 style="font-size:13px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px">English</h3>
        <div style="background:#F5F7FA;border-left:4px solid #4EFFF4;padding:16px 20px;border-radius:0 10px 10px 0;white-space:pre-wrap;font-size:15px;line-height:1.8">${escapeHtml(payload.english)}</div>
      </div>

      <!-- Words -->
      <div style="margin-bottom:28px">
        <h3 style="font-size:13px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px">Important Words</h3>
        <table style="border-collapse:collapse;width:100%">${wordsHtml}</table>
      </div>

      <!-- Japanese -->
      <div style="margin-bottom:32px">
        <h3 style="font-size:13px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px">Japanese Translation</h3>
        <div style="background:#F5F7FA;border-left:4px solid #2A3B6F;padding:16px 20px;border-radius:0 10px 10px 0;white-space:pre-wrap;font-size:15px;line-height:1.8">${escapeHtml(payload.jp)}</div>
      </div>

      <!-- Read Button -->
      <div style="text-align:center;margin:36px 0 16px">
        <a href="${payload.readUrl}"
           style="display:inline-block;background:#4EFFF4;color:#1d1f42;font-weight:800;font-size:18px;padding:16px 48px;border-radius:12px;text-decoration:none;letter-spacing:0.5px;box-shadow:0 4px 15px rgba(78,255,244,0.3)">
          Read ✔
        </a>
        <div style="color:#6B7280;font-size:12px;margin-top:10px">
          タップすると学習ログに記録されます
        </div>
      </div>${payload.upgradeUrl ? `
      <!-- Upgrade CTA -->
      <div style="margin:8px 0 16px">
        <a href="${payload.upgradeUrl}"
           style="display:block;background:#1d1f42;color:#ffffff;font-weight:700;font-size:15px;padding:16px 24px;border-radius:12px;text-decoration:none;text-align:center;letter-spacing:0.3px">
          Standardプラン（月額500円、初回1週間無料）への登録はこちら
        </a>
      </div>` : ""}
    </div>

    <!-- Footer -->
    <div style="background:#F5F7FA;padding:16px 28px;border-radius:0 0 12px 12px;text-align:center">
      <div style="font-size:12px;color:#9CA3AF;margin-bottom:8px">TapSmart English — tapsmart.jp</div>
      <div style="font-size:11px;color:#9CA3AF">
        配信を停止するには、「学習プラン」画面の「一時停止」をご利用ください<br />
        <a href="${payload.settingsUrl || 'https://www.tapsmart.jp/routine'}" style="color:#6B7280;text-decoration:underline">学習プランを開く</a>
      </div>
    </div>
  </div>
  `;
}
