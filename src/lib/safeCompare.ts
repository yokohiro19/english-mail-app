import crypto from "crypto";

/**
 * Timing-safe string comparison to prevent timing attacks.
 * Returns true only if both strings are non-empty and equal.
 */
export function safeCompare(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
