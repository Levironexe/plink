import type { NextRequest } from "next/server";
import type { Stripe } from "@plink/payments";
import { z } from "zod";
import { prisma } from "@plink/db";
import { fail, ok, readJson, tooMany } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { absoluteUrl, getStripe, paymentIntentDataFor, stripeEnabled } from "@plink/payments";

const schema = z.object({
  productId: z.string().min(1),
  email: z.string().email().optional(),
});

/**
 * Opens a Stripe Checkout session for a creator's product. The Order is written
 * as `pending` here and only flipped to `paid` by the webhook, so a buyer who
 * abandons the hosted page never counts as a sale.
 */
export async function POST(req: NextRequest) {
  const limit = rateLimit(clientKey(req, "checkout-product"), 20, 10 * 60_000);
  if (!limit.ok) return tooMany(limit.retryAfter);

  if (!stripeEnabled()) return fail("Payments are not configured on this deployment", 503);

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Invalid checkout request", 422);

  const { productId, email } = parsed.data;
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      user: {
        select: { id: true, username: true, plan: true, stripeAccountId: true, payoutsEnabled: true },
      },
    },
  });

  if (!product || !product.published) return fail("Product not found", 404);
  if (product.priceCents <= 0) return fail("This product is not for sale", 422);

  const creator = product.user;
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: product.currency.toLowerCase(),
          unit_amount: product.priceCents,
          product_data: {
            name: product.name,
            ...(product.description ? { description: product.description.slice(0, 500) } : {}),
            // Stripe only accepts publicly reachable image URLs.
            ...(product.imageUrl?.startsWith("https://") ? { images: [product.imageUrl] } : {}),
          },
        },
      },
    ],
    success_url: absoluteUrl(`/${creator.username}?purchase=success&session_id={CHECKOUT_SESSION_ID}`),
    cancel_url: absoluteUrl(`/${creator.username}?purchase=cancelled`),
    metadata: { kind: "product", productId: product.id, creatorId: creator.id },
    ...(email ? { customer_email: email } : {}),
  };

  const paymentIntentData = paymentIntentDataFor(product.priceCents, creator);
  if (paymentIntentData) params.payment_intent_data = paymentIntentData;

  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.create(params);
  } catch (error) {
    console.error("[stripe] product checkout failed:", error instanceof Error ? error.message : "unknown error");
    return fail("Could not start checkout. Please try again.", 502);
  }

  await prisma.order.create({
    data: {
      userId: creator.id,
      productId: product.id,
      email: email ?? "pending@plink.local",
      amountCents: product.priceCents,
      status: "pending",
      stripeSessionId: session.id,
    },
  });

  return ok({ url: session.url, sessionId: session.id });
}
