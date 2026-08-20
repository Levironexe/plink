"use client";

import * as React from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { cn } from "@plink/core/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "ink" | "lime";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  // A single ink CTA carries every conversion target.
  primary: "bg-ink text-white hover:bg-ink/90 active:bg-black",
  ink: "bg-ink text-white hover:bg-ink/90 active:bg-black",
  secondary: "bg-surface text-ink border border-line hover:bg-canvas-deep hover:border-line-strong/50",
  outline: "border border-line bg-surface text-ink hover:bg-canvas-deep hover:border-line-strong/50",
  ghost: "text-ink-soft hover:bg-canvas-deep hover:text-ink",
  danger: "bg-danger text-white hover:bg-danger-deep active:bg-danger-deep",
  lime: "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700",
};

// In-app controls take the tight 6px square; marketing CTAs take the 100px pill.
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[14px] gap-1.5",
  md: "h-10 px-4 text-[14px] gap-2",
  lg: "h-12 px-6 text-[16px] gap-2.5",
};

const baseClasses =
  "inline-flex items-center justify-center font-medium tracking-[-0.02em] transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  /** Marketing-scale 100px pill. Defaults to the in-app 6px square. */
  pill?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, fullWidth, pill, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        baseClasses,
        variants[variant],
        sizes[size],
        pill ? "rounded-full" : "rounded-md",
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export type ButtonLinkProps = React.ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  pill?: boolean;
};

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  fullWidth,
  pill,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        baseClasses,
        variants[variant],
        sizes[size],
        pill ? "rounded-full" : "rounded-md",
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
}
