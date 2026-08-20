import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/toast";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata: Metadata = {
  title: "Set up your page",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.onboarded) redirect("/dashboard");

  return (
    <ToastProvider>
      <OnboardingFlow username={user.username} userId={user.id} />
    </ToastProvider>
  );
}
