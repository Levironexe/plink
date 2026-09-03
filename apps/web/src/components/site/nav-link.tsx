import * as React from "react";
import Link from "next/link";
import { cn } from "@plink/core/utils";
import type { SiteNavItem, SiteRenderMode } from "./site-model";

/**
 * One nav entry. Live pages use <Link> so switching pages is client-side
 * navigation; previews render an inert span because they are embedded inside
 * other pages (editor, template cards) where nested navigation would be wrong —
 * the same rule the profile renderer's Tappable applies to its anchors.
 *
 * The current page is marked with `aria-current="page"`; templates style it
 * through `currentClassName`/`currentStyle` so highlighting is per-layout.
 */
export function SiteNavLink({
  item,
  mode,
  className,
  currentClassName,
  style,
  currentStyle,
}: {
  item: SiteNavItem;
  mode: SiteRenderMode;
  className?: string;
  currentClassName?: string;
  style?: React.CSSProperties;
  currentStyle?: React.CSSProperties;
}) {
  const cls = cn(className, item.current && currentClassName);
  const css = item.current ? { ...style, ...currentStyle } : style;
  const current = item.current ? ("page" as const) : undefined;

  if (mode === "preview") {
    return (
      <span className={cls} style={css} aria-current={current}>
        {item.title}
      </span>
    );
  }
  return (
    <Link href={item.href} className={cls} style={css} aria-current={current}>
      {item.title}
    </Link>
  );
}
