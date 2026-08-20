import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, ok, readJson, tooMany } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  name: z.string().max(80).optional(),
});

export async function POST(req: NextRequest) {
  const limit = rateLimit(clientKey(req, "subscribe"), 12, 10 * 60_000);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Enter a valid email", 422);

  const { userId, email, name } = parsed.data;
  const creator = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!creator) return fail("Page not found", 404);

  await prisma.subscriber.upsert({
    where: { userId_email: { userId, email: email.toLowerCase() } },
    create: { userId, email: email.toLowerCase(), name: name ?? "" },
    update: {},
  });

  return ok({ ok: true });
}
