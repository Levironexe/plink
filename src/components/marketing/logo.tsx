import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  href = "/",
  mono = false,
}: {
  className?: string;
  href?: string | null;
  mono?: boolean;
}) {
  const inner = (
    <span className={cn("inline-flex items-center gap-2 font-display text-[19px] font-extrabold tracking-tight", className)}>
      <span
        className={cn(
          "grid size-7 place-items-center rounded-[9px] text-[15px] font-black text-white",
          mono ? "bg-current" : "bg-gradient-to-br from-brand-400 to-brand-700",
        )}
        aria-hidden
      >
        <span className={mono ? "text-canvas" : undefined}>P</span>
      </span>
      Plink
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={href} aria-label="Plink home" className="rounded-lg">
      {inner}
    </Link>
  );
}
