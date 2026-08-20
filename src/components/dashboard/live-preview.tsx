"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, RefreshCw, Smartphone } from "lucide-react";
import { PhoneFrame } from "@/components/profile/phone-frame";
import { ProfileView } from "@/components/profile/profile-view";
import type { PublicProfile } from "@/components/profile/types";
import { cn } from "@/lib/utils";

export function LivePreview({
  profile,
  className,
  sticky = true,
}: {
  profile: PublicProfile;
  className?: string;
  sticky?: boolean;
}) {
  const [nonce, setNonce] = React.useState(0);

  return (
    <div className={cn(sticky && "lg:sticky lg:top-6", className)}>
      <div className="flex items-center justify-between pb-4">
        <p className="inline-flex items-center gap-2 text-[13px] font-bold tracking-wider text-ink-muted uppercase">
          <Smartphone className="size-3.5" aria-hidden />
          Live preview
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setNonce((n) => n + 1)}
            aria-label="Refresh preview"
            className="rounded-lg p-2 text-ink-muted transition hover:bg-black/5 hover:text-ink"
          >
            <RefreshCw className="size-4" />
          </button>
          <Link
            href={`/${profile.username}`}
            target="_blank"
            aria-label="Open live page"
            className="rounded-lg p-2 text-ink-muted transition hover:bg-black/5 hover:text-ink"
          >
            <ExternalLink className="size-4" />
          </Link>
        </div>
      </div>
      <div className="flex justify-center">
        <PhoneFrame key={nonce} className="w-full max-w-[290px]">
          <ProfileView profile={profile} preview />
        </PhoneFrame>
      </div>
    </div>
  );
}

export function MobilePreviewSheet({ profile }: { profile: PublicProfile }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed right-5 bottom-5 z-40 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3.5 text-[14.5px] font-bold text-white shadow-lift transition active:scale-95 lg:hidden"
      >
        <Smartphone className="size-4" aria-hidden />
        Preview
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Page preview"
            className="relative z-10 max-h-[88dvh] w-full overflow-y-auto rounded-t-[28px] bg-surface px-5 pt-5 pb-8"
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line-strong" />
            <LivePreview profile={profile} sticky={false} />
            <button
              onClick={() => setOpen(false)}
              className="mt-6 w-full rounded-2xl border border-line py-3 text-[15px] font-semibold text-ink"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
