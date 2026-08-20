import { describe, expect, it } from "vitest";
import { clientKey, rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  it("allows requests up to the limit and blocks the next one", () => {
    const key = `test-${Math.random()}`;
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);

    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("counts each key independently", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    rateLimit(a, 1, 60_000);
    expect(rateLimit(a, 1, 60_000).ok).toBe(false);
    expect(rateLimit(b, 1, 60_000).ok).toBe(true);
  });

  it("reports the remaining allowance", () => {
    const key = `rem-${Math.random()}`;
    expect(rateLimit(key, 5, 60_000).remaining).toBe(4);
    expect(rateLimit(key, 5, 60_000).remaining).toBe(3);
  });
});

describe("clientKey", () => {
  it("prefers the first x-forwarded-for entry", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.9, 70.41.3.18" },
    });
    expect(clientKey(req, "login")).toBe("login:203.0.113.9");
  });

  it("falls back to x-real-ip and then to a local bucket", () => {
    const withReal = new Request("https://example.com", { headers: { "x-real-ip": "198.51.100.7" } });
    expect(clientKey(withReal, "signup")).toBe("signup:198.51.100.7");
    expect(clientKey(new Request("https://example.com"), "signup")).toBe("signup:local");
  });
});
