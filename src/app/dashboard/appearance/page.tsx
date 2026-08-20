import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUserId } from "@/lib/auth";
import { loadEditorData } from "@/lib/dashboard-data";
import { AppearanceEditor } from "@/components/dashboard/appearance-editor";

export const metadata: Metadata = { title: "Appearance" };

export default async function AppearancePage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const data = await loadEditorData(userId);
  if (!data) redirect("/login");

  return <AppearanceEditor initial={data} />;
}
