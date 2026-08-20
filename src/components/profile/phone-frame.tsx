import { cn } from "@/lib/utils";

export function PhoneFrame({
  children,
  className,
  chrome = true,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  chrome?: boolean;
  label?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-[9/19] w-full max-w-[300px] rounded-[42px] bg-ink p-[10px] shadow-lift",
        className,
      )}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[33px] bg-white">
        {chrome && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-2">
            <div className="h-[22px] w-[86px] rounded-full bg-ink" />
          </div>
        )}
        <div className="no-scrollbar h-full w-full overflow-y-auto overscroll-contain">{children}</div>
      </div>
      {label && (
        <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[13px] font-semibold text-ink-muted">
          {label}
        </span>
      )}
    </div>
  );
}
