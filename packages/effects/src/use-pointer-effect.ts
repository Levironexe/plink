"use client";

import * as React from "react";

/**
 * Publishes pointer position onto the element as custom properties, for the
 * three effects that react to the cursor.
 *
 * This is the entire JavaScript cost of the effect system. It attaches nothing
 * unless the chosen effect asks for it, writes straight to the style attribute
 * rather than through React state (a pointermove must never trigger a render),
 * and throttles to one write per animation frame.
 *
 * If it never runs — JS disabled, touch device, a crawler — the effects that
 * use it fall back to their `50%` defaults and simply look static.
 */
export function usePointerEffect<T extends HTMLElement>(enabled: boolean) {
  const ref = React.useRef<T | null>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!enabled || !node) return;
    if (typeof window === "undefined") return;
    // Coarse pointers have no hover to track; skip the listener entirely.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let frame = 0;
    let pending: { x: number; y: number } | null = null;

    const write = () => {
      frame = 0;
      if (!pending) return;
      const { x, y } = pending;
      pending = null;
      node.style.setProperty("--pl-mx", `${x}%`);
      node.style.setProperty("--pl-my", `${y}%`);
      node.style.setProperty("--pl-dx", ((x - 50) / 50).toFixed(3));
      node.style.setProperty("--pl-dy", ((y - 50) / 50).toFixed(3));
    };

    const onMove = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      pending = {
        x: ((event.clientX - rect.left) / rect.width) * 100,
        y: ((event.clientY - rect.top) / rect.height) * 100,
      };
      frame ||= requestAnimationFrame(write);
    };

    const onLeave = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      pending = null;
      for (const property of ["--pl-mx", "--pl-my", "--pl-dx", "--pl-dy"]) {
        node.style.removeProperty(property);
      }
    };

    node.addEventListener("pointermove", onMove, { passive: true });
    node.addEventListener("pointerleave", onLeave, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
    };
  }, [enabled]);

  return ref;
}
