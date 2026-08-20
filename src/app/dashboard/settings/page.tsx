import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsView } from "@/components/dashboard/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [blocks, subscribers, products, views] = await Promise.all([
    prisma.block.count({ where: { userId: user.id } }),
    prisma.subscriber.count({ where: { userId: user.id } }),
    prisma.product.count({ where: { userId: user.id } }),
    prisma.pageView.count({ where: { userId: user.id } }),
  ]);

  return (
    <SettingsView
      username={user.username}
      email={user.email}
      plan={user.plan}
      createdAt={user.createdAt.toISOString()}
      counts={{ blocks, subscribers, products, views }}
    />
  );
}
