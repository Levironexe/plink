import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@plink/db";
import { stripeEnabled } from "@plink/payments";
import { BillingView } from "./_components/billing-view";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [orders, revenue] = await Promise.all([
    prisma.order.count({ where: { userId: user.id, status: "paid" } }),
    prisma.order.aggregate({
      where: { userId: user.id, status: "paid" },
      _sum: { amountCents: true },
    }),
  ]);

  return (
    <BillingView
      configured={stripeEnabled()}
      plan={user.plan}
      planStatus={user.planStatus}
      planInterval={user.planInterval}
      planRenewsAt={user.planRenewsAt?.toISOString() ?? null}
      connected={Boolean(user.stripeAccountId)}
      payoutsEnabled={user.payoutsEnabled}
      sales={{ orders, revenueCents: revenue._sum.amountCents ?? 0 }}
    />
  );
}
