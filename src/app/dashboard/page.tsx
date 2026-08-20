import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUserId } from "@/lib/auth";
import { loadEditorData } from "@/lib/dashboard-data";
import { PageEditor } from "@/components/dashboard/page-editor";

export const metadata: Metadata = { title: "My page" };

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const data = await loadEditorData(userId);
  if (!data) redirect("/login");

  return <PageEditor initial={data} />;
}
