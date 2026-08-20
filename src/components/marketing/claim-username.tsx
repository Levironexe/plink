"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, LoaderCircle, X } from "lucide-react";
import { cn, slugifyUsername } from "@/lib/utils";
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
      ? "That one’s free — grab it"
      : status === "taken"
        ? (reason ?? "Already taken")
        : status === "short"
          ? "At least 3 characters"
          : "Free forever. No card needed.";

  const tall = size === "lg";

  return (
    <div className="w-full max-w-[500px]">
      <form
        onSubmit={submit}
        className={cn(
          "flex items-center gap-2 rounded-2xl border-2 border-ink bg-surface p-1.5 shadow-[5px_5px_0_0_var(--color-ink)] transition-shadow focus-within:shadow-[2px_2px_0_0_var(--color-ink)]",
          tall && "sm:rounded-[20px]",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center pl-3">
          <span className={cn("shrink-0 font-semibold text-ink-muted", tall ? "text-[15px]" : "text-sm")}>
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
              "w-full min-w-0 border-0 bg-transparent px-0.5 font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-muted",
              tall ? "py-3 text-[15px]" : "py-2.5 text-sm",
            )}
          />
          {status === "checking" && <LoaderCircle className="mr-2 size-4 shrink-0 animate-spin text-ink-muted" />}
          {status === "available" && <Check className="mr-2 size-4 shrink-0 text-[#16a34a]" />}
          {(status === "taken" || status === "short") && <X className="mr-2 size-4 shrink-0 text-coral" />}
        </div>
        <button
          type="submit"
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-[14px] bg-ink font-bold text-white transition hover:bg-brand-600 active:scale-[0.98]",
            tall ? "px-5 py-3.5 text-[15px]" : "px-4 py-2.5 text-sm",
          )}
        >
          Claim
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </form>
      <p
        className={cn(
          "mt-2 min-h-5 pl-1 text-[13px] font-medium",
          status === "available"
            ? "text-[#16a34a]"
            : status === "taken" || status === "short"
              ? "text-coral"
              : "text-ink-muted",
        )}
        aria-live="polite"
      >
        {message}
      </p>
    </div>
  );
}
