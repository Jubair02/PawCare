import { ApiError } from "@/lib/auth";

/**
 * Fixed-window rate limiter held in process memory.
 *
 * Scope: this counts per server instance. With `output: "standalone"` and a
 * single container that is the whole surface, but a multi-instance or
 * serverless deployment needs a shared store (Redis/Upstash) for the limit to
 * be real. Swap `hit()` for that when the app scales out.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

// Bound the map so a flood of distinct keys cannot grow it without limit.
const MAX_TRACKED_KEYS = 10_000;

function sweep(now: number) {
  if (windows.size < MAX_TRACKED_KEYS) return;
  for (const [key, w] of windows) {
    if (w.resetAt <= now) windows.delete(key);
  }
  // Still oversized (all windows live) - drop the oldest entries.
  if (windows.size >= MAX_TRACKED_KEYS) {
    const excess = windows.size - Math.floor(MAX_TRACKED_KEYS / 2);
    let dropped = 0;
    for (const key of windows.keys()) {
      windows.delete(key);
      if (++dropped >= excess) break;
    }
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/** Records one attempt against `key`. */
export function hit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { ok: true, remaining: limit - existing.count, retryAfterSeconds: 0 };
}

/** Clears a key's window - call after a successful login so honest users reset. */
export function reset(key: string) {
  windows.delete(key);
}

/** Best-effort client IP from the proxy headers Caddy/Vercel set. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Throws 429 when the caller has exceeded `limit` attempts in `windowMs`. */
export function enforce(key: string, limit: number, windowMs: number, message: string) {
  const result = hit(key, limit, windowMs);
  if (!result.ok) {
    throw new ApiError(`${message} Please try again in ${result.retryAfterSeconds}s.`, 429);
  }
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
