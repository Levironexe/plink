import { cn } from "@plink/core/utils";

/** Section eyebrow — the technical voice. Monospace, never uppercase-tracked. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 font-mono text-[12px] leading-4 text-ink-soft",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  body,
  align = "center",
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", align === "center" ? "items-center text-center" : "items-start", className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="max-w-3xl text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.15] font-semibold tracking-[-0.04em] text-ink">
        {title}
      </h2>
      {body && <p className="max-w-2xl text-[18px] leading-7 text-ink-soft">{body}</p>}
    </div>
  );
}
