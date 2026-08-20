import type { NextRequest } from "next/server";
import type { Stripe } from "@plink/payments";
import { z } from "zod";
import { prisma } from "@plink/db";
import { fail, ok, readJson, tooMany } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { absoluteUrl, getStripe, paymentIntentDataFor, stripeEnabled } from "@plink/payments";

const schema = z.object({
  userId: z.string().min(1),
  amountCents: z.number().int().min(100).max(1_000_00),
  email: z.string().email().optional(),
});

/**
 * Tips have no Product row behind them, so the line item is priced ad hoc from
 * the posted amount. The Order lands as `pending` and the webhook confirms it.
 */
export async function POST(req: NextRequest) {
  const limit = rateLimit(clientKey(req, "tip"), 20, 10 * 60_000);
  if (!limit.ok) return tooMany(limit.retryAfter);

  if (!stripeEnabled()) return fail("Payments are not configured on this deployment", 503);

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Invalid tip amount", 422);

  const { userId, amountCents, email } = parsed.data;
  const creator = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, displayName: true, plan: true, stripeAccountId: true, payoutsEnabled: true },
  });
  if (!creator) return fail("Page not found", 404);

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: `Tip for ${creator.displayName}`,
            description: `Support @${creator.username} on Plink`,
          },
        },
      },
    ],
    success_url: absoluteUrl(`/${creator.username}?tip=success&session_id={CHECKOUT_SESSION_ID}`),
    cancel_url: absoluteUrl(`/${creator.username}?tip=cancelled`),
    metadata: { kind: "tip", creatorId: creator.id },
    ...(email ? { customer_email: email } : {}),
  };

  const paymentIntentData = paymentIntentDataFor(amountCents, creator);
  if (paymentIntentData) params.payment_intent_data = paymentIntentData;

  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.create(params);
  } catch (error) {
    console.error("[stripe] tip checkout failed:", error instanceof Error ? error.message : "unknown error");
    return fail("Could not start checkout. Please try again.", 502);
  }

  await prisma.order.create({
    data: {
      userId: creator.id,
      email: email ?? "anonymous@plink.local",
      amountCents,
      status: "pending",
      stripeSessionId: session.id,
    },
  });

  return ok({ url: session.url, sessionId: session.id });
}
