import { cn } from "@/lib/utils";

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
        <h1 className="text-[26px] leading-tight font-extrabold text-ink sm:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-ink-muted">{description}</p>}
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
    <div className="flex flex-col items-center rounded-[24px] border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-canvas text-ink-muted">
        <Icon className="size-6" />
      </span>
      <h2 className="mt-5 text-[19px] font-bold text-ink">{title}</h2>
      <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-ink-muted">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
