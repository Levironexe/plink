import type { NextRequest } from "next/server";
import type { Stripe } from "@plink/payments";
import { z } from "zod";
import { prisma } from "@plink/db";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok, readJson, tooMany } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { absoluteUrl, getStripe, priceIdFor, stripeEnabled } from "@plink/payments";

const schema = z.object({
  plan: z.enum(["pro", "vip"]),
  interval: z.enum(["month", "year"]).default("month"),
});

/** Starts a subscription Checkout session for the signed-in creator. */
export async function POST(req: NextRequest) {
  const limit = rateLimit(clientKey(req, "checkout-subscription"), 15, 10 * 60_000);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const user = await getCurrentUser();
  if (!user) return fail("Not signed in", 401);

  if (!stripeEnabled()) return fail("Payments are not configured on this deployment", 503);

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Pick a plan and a billing interval", 422);

  const { plan, interval } = parsed.data;
  const priceId = priceIdFor(plan, interval);
  if (!priceId) return fail(`No Stripe price is configured for ${plan} billed ${interval}ly`, 503);

  const stripe = getStripe();

  let session: Stripe.Checkout.Session;
  try {
    // Reusing the customer keeps a creator's invoices and cards on one record.
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.displayName,
        metadata: { userId: user.id, username: user.username },
      });
      customerId = customer.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
    }

    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: absoluteUrl("/dashboard/billing?upgrade=success&session_id={CHECKOUT_SESSION_ID}"),
      cancel_url: absoluteUrl("/dashboard/billing?upgrade=cancelled"),
      metadata: { kind: "subscription", userId: user.id, plan, interval },
      subscription_data: { metadata: { userId: user.id, plan, interval } },
    });
  } catch (error) {
    console.error("[stripe] subscription checkout failed:", error instanceof Error ? error.message : "unknown error");
    return fail("Could not start checkout. Please try again.", 502);
  }

  return ok({ url: session.url, sessionId: session.id });
}
