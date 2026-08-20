"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, LoaderCircle, X } from "lucide-react";
import { cn, slugifyUsername } from "@plink/core/utils";
import { useUsernameAvailability } from "@/lib/hooks";

export function ClaimUsername({
  size = "lg",
  autoFocus = false,
}: {
  size?: "md" | "lg";
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState("");
  const { status, reason } = useUsernameAvailability(value);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value) return;
    router.push(`/signup?username=${encodeURIComponent(value)}`);
  }

  const message =
    status === "available"
      ? "Available"
      : status === "taken"
        ? (reason ?? "Already taken")
        : status === "short"
          ? "At least 3 characters"
          : "Free to start. No card required.";

  const tall = size === "lg";

  return (
    <div className="w-full max-w-[500px]">
      <form
        onSubmit={submit}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-line bg-surface p-1.5 shadow-soft transition-shadow focus-within:border-ink focus-within:shadow-[0_0_0_1px_var(--color-ink)]",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center pl-3">
          <span className={cn("shrink-0 font-mono text-ink-muted", tall ? "text-[14px]" : "text-[13px]")}>
            plink.to/
          </span>
          <input
            value={value}
            autoFocus={autoFocus}
            onChange={(e) => setValue(slugifyUsername(e.target.value))}
            placeholder="yourname"
            aria-label="Choose your Plink username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={cn(
              "w-full min-w-0 border-0 bg-transparent px-0.5 font-medium tracking-[-0.02em] text-ink outline-none placeholder:font-normal placeholder:text-ink-muted",
              tall ? "py-2.5 text-[15px]" : "py-2 text-[14px]",
            )}
          />
          {status === "checking" && <LoaderCircle className="mr-2 size-4 shrink-0 animate-spin text-ink-muted" />}
          {status === "available" && <Check className="mr-2 size-4 shrink-0 text-brand-500" />}
          {(status === "taken" || status === "short") && <X className="mr-2 size-4 shrink-0 text-danger" />}
        </div>
        <button
          type="submit"
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-md bg-ink font-medium tracking-[-0.02em] text-white transition-colors hover:bg-ink/90",
            tall ? "px-4 py-2.5 text-[14px]" : "px-3.5 py-2 text-[13px]",
          )}
        >
          Claim
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </form>
      <p
        className={cn(
          "mt-2 min-h-5 pl-1 font-mono text-[12px] leading-4",
          status === "available"
            ? "text-brand-500"
            : status === "taken" || status === "short"
              ? "text-danger"
              : "text-ink-muted",
        )}
        aria-live="polite"
      >
        {message}
      </p>
    </div>
  );
}
