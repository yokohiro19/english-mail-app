import crypto from "crypto";

type ReadTokenPayload = {
  uid: string;
  dateKey: string;      // YYYY-MM-DD
  deliveryId: string;   // uid_YYYY-MM-DD
  exp: number;          // unix seconds
};

function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromBase64url(s: string) {
  const pad = 4 - (s.length % 4 || 4);
  const padded = s + "=".repeat(pad === 4 ? 0 : pad);
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

export function signReadToken(payload: Omit<ReadTokenPayload, "exp">, expiresInDays = 7) {
  const secret = process.env.READ_TOKEN_SECRET;
  if (!secret) throw new Error("READ_TOKEN_SECRET is not set");

  const exp = Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60;
  const full: ReadTokenPayload = { ...payload, exp };

  const body = base64url(JSON.stringify(full));
  const sig = crypto.createHmac("sha256", secret).update(body).digest();
  return `${body}.${base64url(sig)}`;
}

export function verifyReadToken(token: string): ReadTokenPayload {
  const secret = process.env.READ_TOKEN_SECRET;
  if (!secret) throw new Error("READ_TOKEN_SECRET is not set");

  const [body, sig] = token.split(".");
  if (!body || !sig) throw new Error("Invalid token format");

  const expected = crypto.createHmac("sha256", secret).update(body).digest();
  const given = fromBase64url(sig);

  // timingSafeEqual は長さ一致が前提なのでガード
  if (given.length !== expected.length) throw new Error("Invalid signature");
  if (!crypto.timingSafeEqual(given, expected)) throw new Error("Invalid signature");

  const payload = JSON.parse(fromBase64url(body).toString("utf-8")) as ReadTokenPayload;

  if (!payload.exp || Math.floor(Date.now() / 1000) > payload.exp) {
    throw new Error("Token expired");
  }

  if (!payload.uid || !payload.dateKey || !payload.deliveryId) {
    throw new Error("Invalid payload");
  }

  return payload;
}