import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, ok, readJson, tooMany } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  userId: z.string().min(1),
  amountCents: z.number().int().min(100).max(1_000_00),
  email: z.string().email().optional(),
});

/**
 * Records a tip. Payment capture is intentionally not wired to a live processor
 * in this build — swap this handler for a Stripe Checkout session and move the
 * order write into the webhook when real money is involved.
 */
export async function POST(req: NextRequest) {
  const limit = rateLimit(clientKey(req, "tip"), 20, 10 * 60_000);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Invalid tip amount", 422);

  const { userId, amountCents, email } = parsed.data;
  const creator = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!creator) return fail("Page not found", 404);

  const order = await prisma.order.create({
    data: { userId, amountCents, email: email ?? "anonymous@plink.local", status: "paid" },
    select: { id: true },
  });

  return ok({ ok: true, orderId: order.id });
}
