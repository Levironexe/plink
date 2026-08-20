"use client";

import * as React from "react";
import { Check, Copy, Share, X } from "lucide-react";
import { rgba, type ThemeShape } from "@/lib/themes";

export function ProfileActions({
  username,
  theme,
  url,
}: {
  username: string;
  theme: ThemeShape;
  /** Absolute page URL, resolved on the server so there is no client round-trip. */
  url: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `@${username} on Plink`, url });
        return;
      } catch {
        /* user dismissed — fall through to the panel */
      }
    }
    setOpen(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  const chip = {
    background: rgba(theme.textColor, 0.14),
    color: theme.textColor,
    backdropFilter: "blur(10px)",
  } as const;

  return (
    <>
      <button
        onClick={share}
        aria-label="Share this page"
        className="fixed top-4 right-4 z-40 grid size-10 place-items-center rounded-full transition hover:scale-105"
        style={chip}
      >
        <Share className="size-[18px]" aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Share page"
            className="relative z-10 w-full max-w-sm rounded-t-3xl bg-white p-6 shadow-lift sm:rounded-3xl"
          >
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-bold text-ink">Share this page</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1.5 text-ink-muted hover:bg-black/5">
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-line bg-canvas p-2 pl-3.5">
              <span className="min-w-0 flex-1 truncate text-[14px] text-ink-soft">{url}</span>
              <button
                onClick={copy}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-[13.5px] font-bold text-white transition hover:bg-brand-600"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
