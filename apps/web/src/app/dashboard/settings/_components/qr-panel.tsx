"use client";

import * as React from "react";
import { Check, Copy, Download, QrCode } from "lucide-react";
import { Button } from "@plink/ui/button";
import { useToast } from "@plink/ui/toast";
import { cn } from "@plink/core/utils";

/**
 * Offered sizes. Declared here rather than imported from `@/lib/qr` so this
 * client component never drags the Node-only `qrcode` renderer into the browser
 * bundle — the route clamps anything outside 128–1024 anyway.
 */
const SIZES = [256, 512, 1024] as const;

/**
 * QR panel for the dashboard. The image is rendered by `/api/qr`, so what you
 * preview is byte-for-byte what downloads.
 */
export function QrPanel({
  username,
  pageUrl,
  className,
}: {
  username: string;
  /** The URL the code points at — shown so nobody has to guess. */
  pageUrl: string;
  className?: string;
}) {
  const { toast } = useToast();
  const [size, setSize] = React.useState<number>(512);
  const [copied, setCopied] = React.useState(false);

  const src = `/api/qr?username=${encodeURIComponent(username)}&format=svg&size=${size}`;
  const href = (format: "png" | "svg") =>
    `/api/qr?username=${encodeURIComponent(username)}&format=${format}&size=${size}&download=1`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      toast("Page URL copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Couldn’t copy — select the link manually", "error");
    }
  }

  return (
    <section className={cn("rounded-[24px] border border-line bg-surface p-5 shadow-soft", className)}>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-canvas text-ink-soft">
          <QrCode className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold text-ink">QR code</h2>
          <p className="mt-0.5 text-[13.5px] text-ink-muted">
            Put your page on a poster, a card or a screen. Scans land on {pageUrl}.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-start gap-5">
        <div className="grid size-[176px] shrink-0 place-items-center rounded-[16px] border border-line bg-white p-3">
          {/* Served by our own route as SVG — next/image would only add a hop. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={src}
            src={src}
            alt={`QR code for plink.to/${username}`}
            className="size-full animate-pop object-contain"
          />
        </div>

        <div className="min-w-[240px] flex-1">
          <p className="field-label">Size</p>
          <div className="flex gap-1.5" role="group" aria-label="QR size">
            {SIZES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={size === value}
                onClick={() => setSize(value)}
                className={cn(
                  "h-8 rounded-md border px-3 text-[13.5px] font-medium transition-colors",
                  size === value
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-surface text-ink-soft hover:bg-canvas-deep",
                )}
              >
                {value}px
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={copy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              Copy page URL
            </Button>
            <a
              href={href("png")}
              download={`${username}-plink-qr.png`}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-ink px-3 text-[14px] font-medium tracking-[-0.02em] text-white transition-colors hover:bg-ink/90"
            >
              <Download className="size-4" aria-hidden /> PNG
            </a>
            <a
              href={href("svg")}
              download={`${username}-plink-qr.svg`}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[14px] font-medium tracking-[-0.02em] text-ink transition-colors hover:bg-canvas-deep"
            >
              <Download className="size-4" aria-hidden /> SVG
            </a>
          </div>

          <p className="mt-3 text-[12.5px] text-ink-muted">
            SVG stays sharp at any size — use it for print.
          </p>
        </div>
      </div>
    </section>
  );
}
