"use client";

import * as React from "react";
import { usePointerEffect } from "@plink/effects/use-pointer-effect";

/**
 * The site renderer's only client component: a surface whose effect reads the
 * cursor (`needsPointer` in the registry) needs `--pl-mx`/`--pl-my` written to
 * its style attribute, and that hook is the entire JavaScript cost.
 *
 * Everything else — templates, blocks, nav — stays server-rendered; callers
 * reach for this wrapper only when a pointer effect is actually assigned, so
 * the common page ships no extra client code at all. Anchors are the live-mode
 * variant (previews never navigate, so they never get pointer tracking either).
 */
export function PointerSurface({
  as = "div",
  href,
  ariaLabel,
  className,
  style,
  children,
}: {
  as?: "div" | "a";
  /** Only read when `as="a"`. Callers pass an already-`safeUrl`ed value. */
  href?: string;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const ref = usePointerEffect<HTMLElement>(true);

  if (as === "a") {
    return (
      <a
        ref={ref as React.RefObject<HTMLAnchorElement>}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={style}
        aria-label={ariaLabel}
      >
        {children}
      </a>
    );
  }
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={className}
      style={style}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
