import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@plink/db";
import { emailEnabled } from "@plink/email/email";
import { BroadcastsView } from "./_components/broadcasts-view";

export const metadata: Metadata = { title: "Broadcasts" };

export default async function BroadcastsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [broadcasts, reachable, unsubscribed] = await Promise.all([
    prisma.broadcast.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.subscriber.count({ where: { userId: user.id, unsubscribedAt: null } }),
    prisma.subscriber.count({ where: { userId: user.id, NOT: { unsubscribedAt: null } } }),
  ]);

  return (
    <BroadcastsView
      configured={emailEnabled()}
      reachable={reachable}
      unsubscribed={unsubscribed}
      broadcasts={broadcasts.map((b) => ({
        id: b.id,
        subject: b.subject,
        body: b.body,
        status: b.status,
        recipients: b.recipients,
        sentAt: b.sentAt?.toISOString() ?? null,
        createdAt: b.createdAt.toISOString(),
      }))}
    />
  );
}
