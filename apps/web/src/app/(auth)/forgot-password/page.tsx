import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUserId } from "@/lib/auth";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Send yourself a link to reset your Plink password.",
};

export default async function ForgotPasswordPage() {
  if (await getSessionUserId()) redirect("/dashboard");
  return <ForgotPasswordForm />;
}
