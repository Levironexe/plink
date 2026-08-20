import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@plink/db";
import { hashPassword } from "@/lib/auth";
import { fail, ok, readJson, tooMany } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { consumeVerificationToken, invalidateTokens, tokenFailureMessage } from "@plink/email/tokens";

const schema = z.object({
  token: z.string().min(16, "That reset link is invalid"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  const limit = rateLimit(clientKey(req, "reset-password"), 10, 15 * 60_000);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check your details", 422, {
      field: parsed.error.issues[0]?.path[0],
    });
  }

  const claim = await consumeVerificationToken(parsed.data.token, "reset_password");
  if (!claim.ok) return fail(tokenFailureMessage(claim.reason), 400);

  await prisma.user.update({
    where: { id: claim.userId },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });

  // A reset is also a "someone may have had my account" event: drop every live
  // session so an intruder is logged out everywhere, and retire spare tokens.
  await prisma.session.deleteMany({ where: { userId: claim.userId } });
  await invalidateTokens(claim.userId, "reset_password");

  return ok({ ok: true, redirect: "/login" });
}
