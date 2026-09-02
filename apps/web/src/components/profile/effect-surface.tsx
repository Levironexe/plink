"use client";

import * as React from "react";
import { effectById } from "@plink/effects/registry";
import { usePointerEffect } from "@plink/effects/use-pointer-effect";
import { buttonEffectVars, type ThemeShape } from "@plink/core/themes";
import { cn } from "@plink/core/utils";

/**
 * Wraps any themed surface — a link button, an email card, a product row — so
 * the creator's chosen effect applies to it.
 *
 * Every surface on a page goes through here, which is why the effect vocabulary
 * lives in a registry rather than in each block: adding an effect never means
 * touching this file.
 */
export function useSurfaceEffect<T extends HTMLElement>(theme: ThemeShape, preview = false) {
  const effect = effectById(theme.buttonEffect);
  // A preview inside the editor is decorative and often rendered a dozen times
  // over; pointer tracking there would be noise, so it stays static.
  const ref = usePointerEffect<T>(effect.needsPointer && !preview);

  return {
    ref,
    className: effect.className ? cn("pl-fx", effect.className) : undefined,
    style: effect.className ? buttonEffectVars(theme) : undefined,
  };
}

/**
 * The element form, for surfaces that render a plain container. Anything that
 * needs its own element type (an anchor, a form) uses the hook directly.
 */
export function EffectSurface({
  theme,
  preview = false,
  className,
  style,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  theme: ThemeShape;
  preview?: boolean;
}) {
  const { ref, className: effectClassName, style: effectStyle } = useSurfaceEffect<HTMLDivElement>(
    theme,
    preview,
  );
  return (
    <div
      ref={ref}
      className={cn(className, effectClassName)}
      style={{ ...style, ...effectStyle }}
      {...rest}
    >
      {children}
    </div>
  );
}
