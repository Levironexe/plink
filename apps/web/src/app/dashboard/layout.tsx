import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { DashboardShell } from "./_components/shell";
import { ToastProvider } from "@plink/ui/toast";
import { generatedAvatar } from "@plink/core/avatar";
import { initialsOf } from "@plink/core/utils";

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
