import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const keyHex = process.env.CIPHER_KEY;
    const alphabet = process.env.CIPHER_ALPHABET;
    if (!keyHex || !alphabet) {
      return NextResponse.json({ error: "not_configured" }, { status: 500 });
    }

    const K = keyHex.split(",").map((s) => parseInt(s, 16));

    const body = await req.json().catch(() => ({}));
    const values: Record<string, string> = body.values ?? {};

    const decoded: Record<string, string> = {};
    for (const [field, cipher] of Object.entries(values)) {
      const r: Record<string, number> = {};
      for (let i = 0; i < alphabet.length; i++) r[alphabet[i]] = i;
      const bytes: number[] = [];
      for (let i = 0; i < cipher.length; i += 2) {
        bytes.push(((r[cipher[i]] << 4) | r[cipher[i + 1]]) ^ K[(i / 2) % K.length]);
      }
      decoded[field] = new TextDecoder().decode(new Uint8Array(bytes));
    }

    return NextResponse.json({ ok: true, decoded });
  } catch {
    return NextResponse.json({ error: "decode_failed" }, { status: 500 });
  }
}
