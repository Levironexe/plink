/**
 * Single-use `VerificationToken` rows — email confirmation and password reset.
 *
 * The rules are the same for both flows: a cryptographically random secret, a
 * short TTL, and a `usedAt` stamp so a link works exactly once. Validation is
 * split into a pure {@link tokenState} helper and thin Prisma wrappers, which
 * keeps the interesting logic unit-testable without a database.
 */

import { nanoid } from "nanoid";
import { prisma } from "@plink/db";
import {
  absoluteUrl,
  resetPasswordTemplate,
  sendEmail,
  verifyEmailTemplate,
} from "./email";

export const TOKEN_TYPES = ["verify_email", "reset_password"] as const;
export type TokenType = (typeof TOKEN_TYPES)[number];

/** Confirmation links live for a day; reset links for an hour. */
export const TOKEN_TTL_MS: Record<TokenType, number> = {
  verify_email: 24 * 60 * 60 * 1000,
  reset_password: 60 * 60 * 1000,
};

/** 40 random URL-safe characters ≈ 238 bits — far past guessing range. */
const TOKEN_LENGTH = 40;

export function isTokenType(value: string): value is TokenType {
  return (TOKEN_TYPES as readonly string[]).includes(value);
}

export function generateToken() {
  return nanoid(TOKEN_LENGTH);
}

export function expiresAtFor(type: TokenType, now: Date = new Date(), ttlMs = TOKEN_TTL_MS[type]) {
  return new Date(now.getTime() + ttlMs);
}

/* --------------------------------------------------------- pure validation */

export type TokenFailure = "not_found" | "wrong_type" | "expired" | "used";

/** The subset of a `VerificationToken` row that validation actually reads. */
export type TokenRecord = {
  type: string;
  expiresAt: Date;
  usedAt: Date | null;
};

export type TokenCheck = { ok: true } | { ok: false; reason: TokenFailure };

/**
 * Decides whether a stored token may be redeemed. Pure — no clock of its own,
 * no database — so every branch is directly testable.
 */
export function tokenState(record: TokenRecord | null | undefined, expected: TokenType, now: Date = new Date()): TokenCheck {
  if (!record) return { ok: false, reason: "not_found" };
  if (record.type !== expected) return { ok: false, reason: "wrong_type" };
  if (record.usedAt) return { ok: false, reason: "used" };
  if (record.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  return { ok: true };
}

/** Copy shown to the person who clicked a link that no longer works. */
export function tokenFailureMessage(reason: TokenFailure) {
  switch (reason) {
    case "expired":
      return "That link has expired. Request a new one.";
    case "used":
      return "That link has already been used. Request a new one.";
    default:
      return "That link is invalid. Request a new one.";
  }
}

/* ------------------------------------------------------------ persistence */

export type IssuedToken = { token: string; expiresAt: Date };

/**
 * Issues a fresh token, retiring any outstanding tokens of the same type first
 * so a user only ever holds one live link per flow.
 */
export async function createVerificationToken(
  userId: string,
  type: TokenType,
  options: { ttlMs?: number; now?: Date } = {},
): Promise<IssuedToken> {
  const now = options.now ?? new Date();
  const expiresAt = expiresAtFor(type, now, options.ttlMs ?? TOKEN_TTL_MS[type]);
  const token = generateToken();

  await prisma.verificationToken.deleteMany({ where: { userId, type, usedAt: null } });
  await prisma.verificationToken.create({ data: { userId, token, type, expiresAt } });

  return { token, expiresAt };
}

export type TokenLookup = { ok: true; userId: string } | { ok: false; reason: TokenFailure };

/** Validates a token without spending it — useful for pre-flighting a reset form. */
export async function peekVerificationToken(
  token: string,
  type: TokenType,
  now: Date = new Date(),
): Promise<TokenLookup> {
  if (!token) return { ok: false, reason: "not_found" };

  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record) return { ok: false, reason: "not_found" };

  const state = tokenState(record, type, now);
  if (!state.ok) return state;
  return { ok: true, userId: record.userId };
}

/**
 * Validates and spends a token in one step. The `usedAt: null` guard on the
 * update is what makes redemption single-use even if two clicks race.
 */
export async function consumeVerificationToken(
  token: string,
  type: TokenType,
  now: Date = new Date(),
): Promise<TokenLookup> {
  if (!token) return { ok: false, reason: "not_found" };

  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record) return { ok: false, reason: "not_found" };

  const state = tokenState(record, type, now);
  if (!state.ok) return state;

  const claimed = await prisma.verificationToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: now },
  });
  if (claimed.count === 0) return { ok: false, reason: "used" };

  return { ok: true, userId: record.userId };
}

/** Drops every outstanding token of a type, e.g. after a password change. */
export async function invalidateTokens(userId: string, type: TokenType) {
  await prisma.verificationToken.deleteMany({ where: { userId, type, usedAt: null } });
}

/* ------------------------------------------------------------- delivery */

export type EmailUser = { id: string; email: string; displayName?: string | null };

export type IssuedEmail = { delivered: boolean; expiresAt: Date };

/**
 * Creates a `verify_email` token and mails the confirmation link.
 *
 * Call this from signup and from the resend-verification route. It never
 * throws when email is unconfigured — `delivered` is simply `false`.
 */
export async function sendVerificationEmail(user: EmailUser): Promise<IssuedEmail> {
  const { token, expiresAt } = await createVerificationToken(user.id, "verify_email");
  const verifyUrl = absoluteUrl(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);

  const result = await sendEmail({
    to: user.email,
    ...verifyEmailTemplate({ verifyUrl, name: user.displayName }),
  });

  return { delivered: result.sent, expiresAt };
}

/** Creates a `reset_password` token and mails the reset link. Never throws. */
export async function sendPasswordResetEmail(user: EmailUser): Promise<IssuedEmail> {
  const { token, expiresAt } = await createVerificationToken(user.id, "reset_password");
  const resetUrl = absoluteUrl(`/reset-password?token=${encodeURIComponent(token)}`);

  const result = await sendEmail({
    to: user.email,
    ...resetPasswordTemplate({ resetUrl, name: user.displayName }),
  });

  return { delivered: result.sent, expiresAt };
}
