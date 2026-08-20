"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

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
      <h1 className="text-[32px] leading-tight font-extrabold text-ink">Welcome back</h1>
      <p className="mt-2 text-[15px] text-ink-muted">Log in to edit your page.</p>

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
        <Button type="submit" size="lg" fullWidth loading={submitting} className="mt-1">
          Log in
        </Button>
      </form>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-4">
        <p className="text-[13px] font-bold tracking-wide text-ink-muted uppercase">Demo account</p>
        <p className="mt-1.5 text-[14px] text-ink-soft">
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
          className="mt-2.5 text-[13.5px] font-semibold text-brand-600 underline underline-offset-4"
        >
          Fill it in for me
        </button>
      </div>

      <p className="mt-6 text-center text-[14px] text-ink-muted">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-ink underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </div>
  );
}
