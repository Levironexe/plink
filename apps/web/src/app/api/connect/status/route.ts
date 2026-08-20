import { prisma } from "@plink/db";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { getStripe, stripeEnabled } from "@plink/payments";

/** Re-reads the connected account and syncs `payoutsEnabled` back onto the User. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in", 401);

  const idle = {
    configured: stripeEnabled(),
    connected: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
    requirementsDue: 0,
  };

  if (!stripeEnabled() || !user.stripeAccountId) return ok(idle);

  try {
    const account = await getStripe().accounts.retrieve(user.stripeAccountId);
    const chargesEnabled = Boolean(account.charges_enabled);
    const payoutsEnabled = chargesEnabled && Boolean(account.payouts_enabled);

    if (payoutsEnabled !== user.payoutsEnabled) {
      await prisma.user.update({ where: { id: user.id }, data: { payoutsEnabled } });
    }

    return ok({
      configured: true,
      connected: true,
      chargesEnabled,
      payoutsEnabled,
      detailsSubmitted: Boolean(account.details_submitted),
      requirementsDue: account.requirements?.currently_due?.length ?? 0,
    });
  } catch (error) {
    console.error("[stripe] connect status failed:", error instanceof Error ? error.message : "unknown error");
    return fail("Could not read your payout account", 502);
  }
}
