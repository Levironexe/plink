import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/shell";
import { ToastProvider } from "@/components/ui/toast";
import { generatedAvatar } from "@/lib/avatar";
import { initialsOf } from "@/lib/utils";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Plink" },
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboarded) redirect("/onboarding");

  return (
    <ToastProvider>
      <DashboardShell
        username={user.username}
        displayName={user.displayName}
        avatarUrl={user.avatarUrl || generatedAvatar(user.username, initialsOf(user.displayName))}
        plan={user.plan}
      >
        {children}
      </DashboardShell>
    </ToastProvider>
  );
}
