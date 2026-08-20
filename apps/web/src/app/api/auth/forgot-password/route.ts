import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@plink/db";
import { fail, ok, readJson, tooMany } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@plink/email/tokens";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});

/**
 * The response is identical whether or not the address has an account — an
 * attacker must not be able to use this endpoint to enumerate our users.
 */
const SAME_ANSWER = {
  ok: true as const,
  message: "If that email has an account, a reset link is on its way.",
};

export async function POST(req: NextRequest) {
  const limit = rateLimit(clientKey(req, "forgot-password"), 5, 15 * 60_000);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Enter a valid email", 422);

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, displayName: true },
  });

  if (user) await sendPasswordResetEmail(user);

  return ok(SAME_ANSWER);
}
