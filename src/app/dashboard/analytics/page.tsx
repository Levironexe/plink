import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { loadAnalytics } from "@/lib/analytics";
import type { Range } from "@/lib/analytics-shared";
import { AnalyticsView } from "@/components/dashboard/analytics-view";

export const metadata: Metadata = { title: "Analytics" };

const VALID: Range[] = ["7d", "30d", "90d", "all"];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { range } = await searchParams;
  const selected: Range = VALID.includes(range as Range) ? (range as Range) : "30d";
  const data = await loadAnalytics(user.id, selected);

  return (
    <Suspense fallback={<div className="p-10 text-[15px] text-ink-muted">Loading analytics…</div>}>
      <AnalyticsView data={data} username={user.username} />
    </Suspense>
  );
}
