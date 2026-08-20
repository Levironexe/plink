import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUserId } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your Plink account.",
};

export default async function LoginPage() {
  if (await getSessionUserId()) redirect("/dashboard");
  return <LoginForm />;
}
