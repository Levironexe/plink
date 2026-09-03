"use client";

import * as React from "react";
import { applyEffects } from "@plink/effects/registry";
import { cn } from "@plink/core/utils";

/**
 * Wraps content in an entrance effect, CSS-first.
 *
 * The entrance classes in effects.css are inert until `data-entered` lands on
 * the element, so everything inside is fully visible without JavaScript — a
 * crawler, a reader mode, a failed hydration all see the finished page. This
 * component's only job is to set that attribute once, the first time the
 * element scrolls into view, then get out of the way.
 *
 * Reduced motion is honoured twice over: the stylesheet disables the
 * animation under `prefers-reduced-motion`, and this component sets the
 * attribute immediately instead of observing, so nothing ever waits on a
 * reveal that will not play.
 */
export function EntranceGroup({
  effect,
  className,
  children,
  ...rest
}: React.ComponentPropsWithoutRef<"div"> & {
  /** An entrance effect id (e.g. "enter-fade-up"). Unknown ids apply nothing. */
  effect: string | undefined;
}) {
  const effectClass = applyEffects({ entrance: effect });
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node || !effectClass) return;
    if (node.hasAttribute("data-entered")) return;

    const enter = () => node.setAttribute("data-entered", "");

    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      enter();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          enter();
          observer.disconnect();
        }
      },
      // Any pixel crossing a line just above the bottom edge counts, so even
      // sections taller than the viewport (where a fractional threshold could
      // never be reached) still enter.
      { rootMargin: "0px 0px -10% 0px", threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [effectClass]);

  return (
    <div ref={ref} className={cn(effectClass, className) || undefined} {...rest}>
      {children}
    </div>
  );
}
