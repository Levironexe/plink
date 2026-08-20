import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AudienceView } from "@/components/dashboard/audience-view";

export const metadata: Metadata = { title: "Audience" };

export default async function AudiencePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const subscribers = await prisma.subscriber.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const days: { label: string; value: number }[] = [];
  const buckets = new Map<string, number>();
  for (const s of subscribers) {
    const key = s.createdAt.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ label: key, value: buckets.get(key) ?? 0 });
  }

  return (
    <AudienceView
      plan={user.plan}
      growth={days}
      subscribers={subscribers.map((s) => ({
        id: s.id,
        email: s.email,
        name: s.name,
        source: s.source,
        createdAt: s.createdAt.toISOString(),
      }))}
    />
  );
}
