import type { NextRequest } from "next/server";
import { prisma } from "@plink/db";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok, tooMany } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { absoluteUrl, getStripe, stripeEnabled } from "@plink/payments";

/**
 * Creates (or reuses) the creator's Express account and hands back a one-shot
 * onboarding link. Account links expire quickly, so this is called per visit.
 */
export async function POST(req: NextRequest) {
  const limit = rateLimit(clientKey(req, "connect-onboard"), 10, 10 * 60_000);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const user = await getCurrentUser();
  if (!user) return fail("Not signed in", 401);

  if (!stripeEnabled()) return fail("Payments are not configured on this deployment", 503);

  const stripe = getStripe();

  try {
    let accountId = user.stripeAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email,
        business_profile: { name: user.displayName || user.username },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { userId: user.id, username: user.username },
      });
      accountId = account.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeAccountId: accountId } });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: absoluteUrl("/dashboard/billing?connect=refresh"),
      return_url: absoluteUrl("/dashboard/billing?connect=done"),
    });

    return ok({ url: link.url });
  } catch (error) {
    console.error("[stripe] connect onboarding failed:", error instanceof Error ? error.message : "unknown error");
    return fail("Could not start payout onboarding. Please try again.", 502);
  }
}
