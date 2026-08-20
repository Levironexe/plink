"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, LoaderCircle, X } from "lucide-react";
import { Button } from "@plink/ui/button";
import { TextField } from "@plink/ui/field";
import { useToast } from "@plink/ui/toast";
import { cn, slugifyUsername } from "@plink/core/utils";
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
      <h1 className="text-[30px] leading-9 font-semibold tracking-[-0.045em] text-ink">Claim your link.</h1>
      <p className="mt-2 text-[15px] leading-6 text-ink-soft">
        Free to start, no card required, live in two minutes.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        <div>
          <label htmlFor="username" className="field-label">
            Your Plink
          </label>
          <div
            className={cn(
              "flex items-center rounded-md border bg-surface pr-3 transition",
              errors.username || status === "taken" || status === "short"
                ? "border-danger"
                : status === "available"
                  ? "border-brand-500"
                  : "border-line focus-within:border-ink focus-within:shadow-[0_0_0_1px_var(--color-ink)]",
            )}
          >
            <span className="py-2 pl-3 font-mono text-[14px] text-ink-muted">plink.to/</span>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(slugifyUsername(e.target.value))}
              placeholder="yourname"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              className="min-w-0 flex-1 border-0 bg-transparent py-2 pl-0.5 text-[14px] font-medium tracking-[-0.02em] text-ink outline-none"
            />
            {status === "checking" && <LoaderCircle className="size-4 animate-spin text-ink-muted" />}
            {status === "available" && <Check className="size-4 text-brand-500" />}
            {status === "taken" && <X className="size-4 text-danger" />}
          </div>
          <p
            className={cn(
              "mt-1.5 min-h-5 font-mono text-[12px] leading-4",
              errors.username || status === "taken" || status === "short"
                ? "text-danger"
                : status === "available"
                  ? "text-brand-500"
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
