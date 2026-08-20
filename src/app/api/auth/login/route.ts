import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword } from "@/lib/auth";
import { fail, ok, readJson, tooMany } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const limit = rateLimit(clientKey(req, "login"), 10, 10 * 60_000);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return fail("Invalid request body");

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check your details", 422);
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: { id: true, passwordHash: true, username: true, onboarded: true },
  });

  // Constant-ish work either way so timing doesn't leak account existence.
  const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !valid) return fail("Email or password is incorrect", 401);

  await createSession(user.id);
  return ok({ ok: true, username: user.username, onboarded: user.onboarded });
}
