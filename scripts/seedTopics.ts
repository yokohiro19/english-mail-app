import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as admin from "firebase-admin";

// env からサービスアカウント取得
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountJson) {
  throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY");
}

const serviceAccount = JSON.parse(serviceAccountJson) as admin.ServiceAccount;

// Admin 初期化
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

type Topic = {
  category: string;
  title: string;
  promptSeed: string;
};

// 最初は最低限でOK（後でAI生成に差し替える）
const BASE_TOPICS: Topic[] = [
  { category: "Marketing", title: "Customer retention", promptSeed: "Explain why customer retention is important in business." },
  { category: "Finance", title: "Cash flow", promptSeed: "Explain what cash flow is and why it matters." },
  { category: "Technology", title: "APIs", promptSeed: "Explain what an API is in simple terms." },
  { category: "Management", title: "Delegation", promptSeed: "Explain how managers should delegate tasks." },
  { category: "HR", title: "Job interviews", promptSeed: "Explain what makes a good job interview." },
  { category: "Startups", title: "MVP", promptSeed: "Explain the idea of a minimum viable product." },
  { category: "Global Business", title: "Cultural differences", promptSeed: "Explain why cultural differences matter in global business." },
  { category: "Economics", title: "Inflation", promptSeed: "Explain inflation in simple terms." },
  { category: "Sustainability", title: "Circular economy", promptSeed: "Explain what a circular economy is." },
  { category: "Communication", title: "Feedback", promptSeed: "Explain how to give constructive feedback." },
];

// 100件になるまで水増し（Phase2はこれで十分）
const topics: Topic[] = [];
while (topics.length < 100) {
  for (const t of BASE_TOPICS) {
    if (topics.length >= 100) break;
    topics.push({
      ...t,
      title: `${t.title} #${topics.length + 1}`,
    });
  }
}

async function main() {
  const batch = db.batch();
  const col = db.collection("topics");

  topics.forEach((t) => {
    const ref = col.doc();
    batch.set(ref, {
      ...t,
      rand: Math.random(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();
  console.log(`✅ Seeded ${topics.length} topics`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
