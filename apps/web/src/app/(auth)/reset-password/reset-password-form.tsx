"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { Button, ButtonLink } from "@plink/ui/button";
import { TextField } from "@plink/ui/field";
import { useToast } from "@plink/ui/toast";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState("");
  const [expired, setExpired] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don’t match");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { error?: string; redirect?: string };
      if (!res.ok) {
        // A 400 here always means the link itself is spent or stale.
        if (res.status === 400) setExpired(true);
        setError(data.error ?? "Could not reset your password");
        return;
      }
      toast("Password updated — log in with your new one");
      router.push(data.redirect ?? "/login");
      router.refresh();
    } catch {
      toast("Network error — please try again", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token || expired) {
    return (
      <div>
        <span className="grid size-12 place-items-center rounded-lg border border-line bg-surface text-ink shadow-soft">
          <CircleAlert className="size-5" aria-hidden />
        </span>
        <h1 className="mt-6 text-[32px] leading-tight font-semibold tracking-[-0.04em] text-ink">
          This link no longer works
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          {error || "Reset links expire after an hour and can only be used once. Request a fresh one and we’ll send it straight over."}
        </p>
        <div className="mt-8 flex flex-col gap-2.5">
          <ButtonLink href="/forgot-password" size="lg" fullWidth>
            Send a new link
          </ButtonLink>
          <ButtonLink href="/login" variant="secondary" size="lg" fullWidth>
            Back to log in
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.04em] text-ink">Set a new password</h1>
      <p className="mt-2 text-[15px] text-ink-soft">
        Pick something you haven’t used before. You’ll be signed out everywhere else.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        <TextField
          label="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
          minLength={8}
        />
        <TextField
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Type it once more"
          autoComplete="new-password"
          required
          error={error}
        />
        <Button type="submit" size="lg" fullWidth loading={submitting} className="mt-1">
          Update password
        </Button>
      </form>

      <p className="mt-6 text-center text-[14px] text-ink-muted">
        Changed your mind?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          Log in
        </Link>
      </p>
    </div>
  );
}
