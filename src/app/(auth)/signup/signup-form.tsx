"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn, slugifyUsername } from "@/lib/utils";
import { useUsernameAvailability } from "@/lib/hooks";

type Errors = Partial<Record<"email" | "password" | "username", string>>;

export function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();

  const [username, setUsername] = React.useState(() => slugifyUsername(params.get("username") ?? ""));
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errors, setErrors] = React.useState<Errors>({});
  const [submitting, setSubmitting] = React.useState(false);
  const { status, reason } = useUsernameAvailability(username);

  const statusMessage =
    status === "available"
      ? "Available"
      : status === "taken"
        ? (reason ?? "Taken")
        : status === "short"
          ? "At least 3 characters"
          : "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, username }),
      });
      const data = (await res.json()) as { error?: string; field?: string };
      if (!res.ok) {
        if (data.field) setErrors({ [data.field]: data.error } as Errors);
        else toast(data.error ?? "Something went wrong", "error");
        return;
      }
      router.push("/onboarding");
      router.refresh();
    } catch {
      toast("Network error — please try again", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-[32px] leading-tight font-extrabold text-ink">Claim your link</h1>
      <p className="mt-2 text-[15px] text-ink-muted">
        Free forever. No card. Live in two minutes.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        <div>
          <label htmlFor="username" className="field-label">
            Your Plink
          </label>
          <div
            className={cn(
              "flex items-center rounded-[14px] border bg-surface pr-3 transition",
              errors.username || status === "taken" || status === "short"
                ? "border-coral"
                : status === "available"
                  ? "border-[#16a34a]"
                  : "border-line-strong focus-within:border-brand-500 focus-within:shadow-[0_0_0_4px_var(--color-brand-100)]",
            )}
          >
            <span className="py-2.5 pl-3.5 text-[15px] font-medium text-ink-muted">plink.to/</span>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(slugifyUsername(e.target.value))}
              placeholder="yourname"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              className="min-w-0 flex-1 border-0 bg-transparent py-2.5 pl-0.5 text-[15px] font-semibold text-ink outline-none"
            />
            {status === "checking" && <LoaderCircle className="size-4 animate-spin text-ink-muted" />}
            {status === "available" && <Check className="size-4 text-[#16a34a]" />}
            {status === "taken" && <X className="size-4 text-coral" />}
          </div>
          <p
            className={cn(
              "mt-1.5 min-h-5 text-[13px] font-medium",
              errors.username || status === "taken" || status === "short"
                ? "text-coral"
                : status === "available"
                  ? "text-[#16a34a]"
                  : "text-ink-muted",
            )}
            aria-live="polite"
          >
            {errors.username ?? statusMessage}
          </p>
        </div>

        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          autoComplete="email"
          required
          error={errors.email}
        />

        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
          minLength={8}
          error={errors.password}
        />

        <Button type="submit" size="lg" fullWidth loading={submitting} className="mt-1">
          Create my Plink
        </Button>
      </form>

      <p className="mt-6 text-center text-[14px] text-ink-muted">
        Already have one?{" "}
        <Link href="/login" className="font-semibold text-ink underline underline-offset-4">
          Log in
        </Link>
      </p>

      <p className="mt-6 text-center text-[12.5px] leading-relaxed text-ink-muted">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="underline">Terms</Link> and{" "}
        <Link href="/privacy" className="underline">Privacy Policy</Link>.
      </p>
    </div>
  );
}
