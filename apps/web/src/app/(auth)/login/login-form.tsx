"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@plink/ui/button";
import { TextField } from "@plink/ui/field";
import { useToast } from "@plink/ui/toast";

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: string; onboarded?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Could not log you in");
        return;
      }
      router.push(data.onboarded ? "/dashboard" : "/onboarding");
      router.refresh();
    } catch {
      toast("Network error — please try again", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-[30px] leading-9 font-semibold tracking-[-0.045em] text-ink">Welcome back.</h1>
      <p className="mt-2 text-[15px] leading-6 text-ink-soft">Log in to edit your page.</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          autoComplete="email"
          required
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          autoComplete="current-password"
          required
          error={error}
        />
        <div className="-mt-1 flex justify-end">
          <Link
            href="/forgot-password"
            className="text-[13px] tracking-[-0.02em] text-ink-soft underline underline-offset-4 transition-colors hover:text-ink"
          >
            Forgot your password?
          </Link>
        </div>
        <Button type="submit" size="lg" fullWidth loading={submitting} className="mt-1">
          Log in
        </Button>
      </form>

      <div className="mt-8 rounded-md border border-line bg-surface p-4">
        <p className="font-mono text-[12px] leading-4 text-ink-muted">Demo account</p>
        <p className="mt-1.5 text-[14px] leading-5 text-ink-soft">
          <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[13px]">maya@plink.demo</code>{" "}
          ·{" "}
          <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[13px]">plinkdemo123</code>
        </p>
        <button
          type="button"
          onClick={() => {
            setEmail("maya@plink.demo");
            setPassword("plinkdemo123");
          }}
          className="mt-2.5 text-[13px] tracking-[-0.02em] text-brand-500 underline underline-offset-4 transition-colors hover:text-brand-600"
        >
          Fill it in for me
        </button>
      </div>

      <p className="mt-6 text-center text-[14px] tracking-[-0.02em] text-ink-soft">
        New here?{" "}
        <Link href="/signup" className="font-medium text-ink underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </div>
  );
}
