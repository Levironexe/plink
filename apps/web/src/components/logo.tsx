import Link from "next/link";
import { cn } from "@plink/core/utils";

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
    <span className={cn("inline-flex items-center gap-2 text-[17px] font-semibold tracking-[-0.04em]", className)}>
      <span
        className={cn(
          "grid size-6 place-items-center rounded-[6px] text-[13px] font-semibold text-white",
          mono ? "bg-current" : "bg-ink",
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
