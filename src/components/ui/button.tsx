"use client";

import * as React from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "ink" | "lime";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 shadow-[0_10px_24px_-12px_var(--color-brand-500)]",
  ink: "bg-ink text-white hover:bg-[#23232c] active:bg-black",
  lime: "bg-lime text-ink hover:brightness-95 active:brightness-90",
  secondary: "bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-200",
  outline: "border border-line-strong bg-surface text-ink hover:bg-canvas hover:border-ink-muted",
  ghost: "text-ink-soft hover:bg-black/5 hover:text-ink",
  danger: "bg-coral text-white hover:brightness-95 active:brightness-90",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5 rounded-[11px]",
  md: "h-11 px-5 text-[15px] gap-2 rounded-[14px]",
  lg: "h-13 px-7 text-base gap-2.5 rounded-[16px]",
};

const baseClasses =
  "inline-flex items-center justify-center font-semibold transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap active:scale-[0.985]";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, fullWidth, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(baseClasses, variants[variant], sizes[size], fullWidth && "w-full", className)}
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
};

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  fullWidth,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(baseClasses, variants[variant], sizes[size], fullWidth && "w-full", className)}
      {...props}
    />
  );
}
