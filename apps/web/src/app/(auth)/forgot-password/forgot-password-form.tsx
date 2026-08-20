"use client";

import * as React from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Button, ButtonLink } from "@plink/ui/button";
import { TextField } from "@plink/ui/field";
import { useToast } from "@plink/ui/toast";

export function ForgotPasswordForm() {
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not send that link");
        return;
      }
      setSent(true);
    } catch {
      toast("Network error — please try again", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div>
        <span className="grid size-12 place-items-center rounded-lg border border-line bg-surface text-ink shadow-soft">
          <MailCheck className="size-5" aria-hidden />
        </span>
        <h1 className="mt-6 text-[32px] leading-tight font-semibold tracking-[-0.04em] text-ink">Check your inbox</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          If <span className="font-medium text-ink">{email}</span> has an account, a reset link is on its way. It
          expires in one hour and works once.
        </p>
        <p className="mt-3 text-[14px] text-ink-muted">
          Nothing after a minute or two? Check spam, or{" "}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="font-medium text-ink underline underline-offset-4"
          >
            try another address
          </button>
          .
        </p>

        <div className="mt-8">
          <ButtonLink href="/login" variant="secondary" size="lg" fullWidth>
            Back to log in
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.04em] text-ink">Forgot your password?</h1>
      <p className="mt-2 text-[15px] text-ink-soft">
        Enter the email on your account and we’ll send a link to set a new one.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          autoComplete="email"
          required
          error={error}
        />
        <Button type="submit" size="lg" fullWidth loading={submitting} className="mt-1">
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-center text-[14px] text-ink-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          Log in
        </Link>
      </p>
    </div>
  );
}
