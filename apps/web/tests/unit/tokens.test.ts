import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = {
  id: string;
  userId: string;
  token: string;
  type: string;
  expiresAt: Date;
  usedAt: Date | null;
};

/**
 * A tiny in-memory stand-in for the `VerificationToken` table. Hoisted so the
 * `vi.mock` factory below can reach it — no database and no network anywhere in
 * this file.
 */
const store = vi.hoisted(() => ({ rows: [] as Row[], seq: 0 }));

vi.mock("@plink/db", () => ({
  prisma: {
    verificationToken: {
      create: async ({ data }: { data: Omit<Row, "id" | "usedAt"> }) => {
        const row: Row = { id: `tok_${++store.seq}`, usedAt: null, ...data };
        store.rows.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { token: string } }) =>
        store.rows.find((r) => r.token === where.token) ?? null,
      deleteMany: async ({ where }: { where: { userId: string; type: string; usedAt: null } }) => {
        const before = store.rows.length;
        store.rows = store.rows.filter(
          (r) => !(r.userId === where.userId && r.type === where.type && r.usedAt === null),
        );
        return { count: before - store.rows.length };
      },
      updateMany: async ({ where, data }: { where: { id: string; usedAt: null }; data: { usedAt: Date } }) => {
        let count = 0;
        for (const row of store.rows) {
          if (row.id === where.id && row.usedAt === null) {
            row.usedAt = data.usedAt;
            count += 1;
          }
        }
        return { count };
      },
    },
  },
}));

const {
  TOKEN_TTL_MS,
  consumeVerificationToken,
  createVerificationToken,
  expiresAtFor,
  generateToken,
  invalidateTokens,
  isTokenType,
  peekVerificationToken,
  sendPasswordResetEmail,
  sendVerificationEmail,
  tokenFailureMessage,
  tokenState,
} = await import("@plink/email/tokens");

beforeEach(() => {
  store.rows = [];
  store.seq = 0;
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://plink.test");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const HOUR = 60 * 60 * 1000;

describe("token shape", () => {
  it("narrows only the two known types", () => {
    expect(isTokenType("verify_email")).toBe(true);
    expect(isTokenType("reset_password")).toBe(true);
    expect(isTokenType("magic_link")).toBe(false);
  });

  it("mints long, unique, URL-safe secrets", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateToken));
    expect(tokens.size).toBe(200);
    for (const token of tokens) {
      expect(token).toHaveLength(40);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("gives confirmation links a day and reset links an hour", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(TOKEN_TTL_MS.verify_email).toBe(24 * HOUR);
    expect(TOKEN_TTL_MS.reset_password).toBe(HOUR);
    expect(expiresAtFor("verify_email", now).toISOString()).toBe("2026-01-02T00:00:00.000Z");
    expect(expiresAtFor("reset_password", now).toISOString()).toBe("2026-01-01T01:00:00.000Z");
  });

  it("honours a caller-supplied TTL", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(expiresAtFor("reset_password", now, 5 * 60_000).toISOString()).toBe("2026-01-01T00:05:00.000Z");
  });
});

describe("tokenState", () => {
  const now = new Date("2026-01-01T12:00:00.000Z");
  const live = { type: "reset_password", expiresAt: new Date("2026-01-01T13:00:00.000Z"), usedAt: null };

  it("accepts a live token of the expected type", () => {
    expect(tokenState(live, "reset_password", now)).toEqual({ ok: true });
  });

  it("rejects a missing row", () => {
    expect(tokenState(null, "reset_password", now)).toEqual({ ok: false, reason: "not_found" });
    expect(tokenState(undefined, "reset_password", now)).toEqual({ ok: false, reason: "not_found" });
  });

  it("rejects a token issued for the other flow", () => {
    expect(tokenState(live, "verify_email", now)).toEqual({ ok: false, reason: "wrong_type" });
  });

  it("rejects a token that has already been spent", () => {
    expect(tokenState({ ...live, usedAt: new Date() }, "reset_password", now)).toEqual({
      ok: false,
      reason: "used",
    });
  });

  it("rejects a token at or past its expiry", () => {
    expect(tokenState({ ...live, expiresAt: now }, "reset_password", now)).toEqual({
      ok: false,
      reason: "expired",
    });
    expect(
      tokenState({ ...live, expiresAt: new Date(now.getTime() - 1) }, "reset_password", now),
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("checks type before expiry so a stale wrong-type token still reads as wrong-type", () => {
    const stale = { type: "verify_email", expiresAt: new Date("2020-01-01T00:00:00.000Z"), usedAt: null };
    expect(tokenState(stale, "reset_password", now)).toEqual({ ok: false, reason: "wrong_type" });
  });
});

describe("tokenFailureMessage", () => {
  it("explains each failure without leaking why the row was missing", () => {
    expect(tokenFailureMessage("expired")).toMatch(/expired/i);
    expect(tokenFailureMessage("used")).toMatch(/already been used/i);
    expect(tokenFailureMessage("not_found")).toMatch(/invalid/i);
    expect(tokenFailureMessage("wrong_type")).toMatch(/invalid/i);
  });
});

describe("createVerificationToken", () => {
  it("persists a row the lookup can find", async () => {
    const { token, expiresAt } = await createVerificationToken("user_1", "verify_email");
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]).toMatchObject({ userId: "user_1", token, type: "verify_email", usedAt: null });
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("retires an outstanding token of the same type so only one link is live", async () => {
    const first = await createVerificationToken("user_1", "reset_password");
    const second = await createVerificationToken("user_1", "reset_password");

    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]?.token).toBe(second.token);
    await expect(peekVerificationToken(first.token, "reset_password")).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("leaves the other flow's token alone", async () => {
    await createVerificationToken("user_1", "verify_email");
    await createVerificationToken("user_1", "reset_password");
    expect(store.rows).toHaveLength(2);
  });
});

describe("consumeVerificationToken", () => {
  it("redeems a live token exactly once", async () => {
    const { token } = await createVerificationToken("user_1", "reset_password");

    await expect(consumeVerificationToken(token, "reset_password")).resolves.toEqual({
      ok: true,
      userId: "user_1",
    });
    await expect(consumeVerificationToken(token, "reset_password")).resolves.toEqual({
      ok: false,
      reason: "used",
    });
  });

  it("refuses a token minted for the other flow, and leaves it unspent", async () => {
    const { token } = await createVerificationToken("user_1", "verify_email");

    await expect(consumeVerificationToken(token, "reset_password")).resolves.toEqual({
      ok: false,
      reason: "wrong_type",
    });
    expect(store.rows[0]?.usedAt).toBeNull();
    await expect(consumeVerificationToken(token, "verify_email")).resolves.toEqual({
      ok: true,
      userId: "user_1",
    });
  });

  it("refuses an expired token", async () => {
    const { token } = await createVerificationToken("user_1", "reset_password", { ttlMs: 1000 });
    const later = new Date(Date.now() + 2000);

    await expect(consumeVerificationToken(token, "reset_password", later)).resolves.toEqual({
      ok: false,
      reason: "expired",
    });
    expect(store.rows[0]?.usedAt).toBeNull();
  });

  it("refuses an unknown or empty token", async () => {
    await expect(consumeVerificationToken("", "reset_password")).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
    await expect(consumeVerificationToken("nope", "reset_password")).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});

describe("peekVerificationToken", () => {
  it("validates without spending the token", async () => {
    const { token } = await createVerificationToken("user_1", "verify_email");

    await expect(peekVerificationToken(token, "verify_email")).resolves.toEqual({
      ok: true,
      userId: "user_1",
    });
    expect(store.rows[0]?.usedAt).toBeNull();
  });
});

describe("invalidateTokens", () => {
  it("drops every live token of a type", async () => {
    await createVerificationToken("user_1", "reset_password");
    await createVerificationToken("user_1", "verify_email");

    await invalidateTokens("user_1", "reset_password");
    expect(store.rows.map((r) => r.type)).toEqual(["verify_email"]);
  });
});

describe("delivery helpers", () => {
  it("still issues a verification token when email is unconfigured", async () => {
    const result = await sendVerificationEmail({ id: "user_1", email: "maya@plink.test", displayName: "Maya" });

    expect(result.delivered).toBe(false);
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]?.type).toBe("verify_email");
    expect(console.warn).toHaveBeenCalled();
  });

  it("issues a reset token with the shorter TTL", async () => {
    const before = Date.now();
    const result = await sendPasswordResetEmail({ id: "user_1", email: "maya@plink.test" });

    expect(result.delivered).toBe(false);
    expect(store.rows[0]?.type).toBe("reset_password");
    expect(result.expiresAt.getTime() - before).toBeLessThanOrEqual(HOUR + 1000);
  });
});
