import { cn } from "@plink/core/utils";

/**
 * Studio-local admin primitives, following the dashboard's `PageHeader` /
 * `EmptyState` conventions. They live here rather than being imported across
 * route areas (constitution Art. V.2) — Feature E extends this directory
 * after merge.
 */

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        <h1 className="text-[24px] leading-8 font-semibold tracking-[-0.04em] text-ink sm:text-[28px]">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-[14px] leading-5 tracking-[-0.02em] text-ink-soft">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-line bg-canvas px-6 py-16 text-center">
      <span className="grid size-11 place-items-center rounded-md border border-line bg-surface text-ink-muted">
        <Icon className="size-5" />
      </span>
      <h2 className="mt-5 text-[16px] font-medium tracking-[-0.02em] text-ink">{title}</h2>
      <p className="mt-2 max-w-sm text-[14px] leading-5 tracking-[-0.02em] text-ink-soft">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  draft: "border-line bg-canvas-deep text-ink-soft",
  published: "border-brand-100 bg-brand-50 text-brand-600",
  submitted: "border-brand-100 bg-brand-50 text-brand-600",
  generated: "border-line bg-canvas-deep text-ink-soft",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[12px] font-medium tracking-[-0.01em]",
        STATUS_STYLES[status] ?? STATUS_STYLES.draft,
        className,
      )}
    >
      {status}
    </span>
  );
}
