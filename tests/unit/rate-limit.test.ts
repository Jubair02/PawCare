import { describe, expect, it } from "vitest";

import { MINUTE, clientIp, enforce, hit, reset } from "@/lib/rate-limit";

const uniqueKey = (prefix: string) => `${prefix}:${Math.random()}`;

describe("rate limiter", () => {
  it("allows exactly the limit, then blocks", () => {
    const key = uniqueKey("login");
    let allowed = 0;
    for (let i = 0; i < 12; i++) {
      if (hit(key, 10, MINUTE).ok) allowed++;
    }
    expect(allowed).toBe(10);
  });

  it("reports a retry hint once blocked", () => {
    const key = uniqueKey("login");
    hit(key, 1, MINUTE);
    const blocked = hit(key, 1, MINUTE);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts down the remaining allowance", () => {
    const key = uniqueKey("login");
    expect(hit(key, 3, MINUTE).remaining).toBe(2);
    expect(hit(key, 3, MINUTE).remaining).toBe(1);
    expect(hit(key, 3, MINUTE).remaining).toBe(0);
  });

  it("clears a window on reset, so a successful login unblocks the user", () => {
    const key = uniqueKey("login");
    hit(key, 1, MINUTE);
    expect(hit(key, 1, MINUTE).ok).toBe(false);
    reset(key);
    expect(hit(key, 1, MINUTE).ok).toBe(true);
  });

  it("starts a fresh window once the old one expires", async () => {
    const key = uniqueKey("window");
    expect(hit(key, 1, 5).ok).toBe(true);
    expect(hit(key, 1, 5).ok).toBe(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(hit(key, 1, 5).ok).toBe(true);
  });

  it("keeps separate keys independent", () => {
    const a = uniqueKey("a");
    const b = uniqueKey("b");
    hit(a, 1, MINUTE);
    expect(hit(a, 1, MINUTE).ok).toBe(false);
    expect(hit(b, 1, MINUTE).ok).toBe(true);
  });

  it("throws a 429 from enforce once the limit is passed", () => {
    const key = uniqueKey("enforce");
    enforce(key, 1, MINUTE, "Too many login attempts.");
    try {
      enforce(key, 1, MINUTE, "Too many login attempts.");
      throw new Error("expected enforce to throw");
    } catch (e) {
      const err = e as Error & { status?: number };
      expect(err.status).toBe(429);
      expect(err.message).toMatch(/Too many login attempts/);
      expect(err.message).toMatch(/try again in \d+s/);
    }
  });
});

describe("clientIp", () => {
  it("takes the first hop from x-forwarded-for", () => {
    const req = new Request("http://x", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(clientIp(req)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to a placeholder", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-real-ip": "198.51.100.4" } }))).toBe(
      "198.51.100.4"
    );
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});
