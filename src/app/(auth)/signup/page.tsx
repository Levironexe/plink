import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUserId } from "@/lib/auth";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Claim your Plink and get a link in bio, store, email list and media kit in one page.",
};

export default async function SignupPage() {
  if (await getSessionUserId()) redirect("/dashboard");
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-black/5" />}>
      <SignupForm />
    </Suspense>
  );
}
