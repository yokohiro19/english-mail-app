type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

type Entry = {
  count: number;
  resetAt: number;
};

/**
 * Simple in-memory rate limiter for Vercel serverless.
 * Per-instance only (not global across instances), but provides
 * basic brute-force protection.
 */
export function createRateLimiter(config: RateLimitConfig) {
  const store = new Map<string, Entry>();
  let lastCleanup = Date.now();

  function cleanup() {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) store.delete(key);
    }
  }

  return {
    check(key: string): { ok: boolean; remaining: number } {
      const now = Date.now();

      if (now - lastCleanup > 60_000) {
        cleanup();
        lastCleanup = now;
      }

      const entry = store.get(key);
      if (!entry || now >= entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + config.windowMs });
        return { ok: true, remaining: config.maxRequests - 1 };
      }

      entry.count++;
      if (entry.count > config.maxRequests) {
        return { ok: false, remaining: 0 };
      }
      return { ok: true, remaining: config.maxRequests - entry.count };
    },
  };
}

/** Extract client IP from request headers */
export function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
