"use client";

import * as React from "react";
import { CalendarClock } from "lucide-react";
import { describeSchedule, scheduleState } from "@plink/core/scheduling";
import { cn } from "@plink/core/utils";
import type { EditorBlock } from "@plink/core/editor-types";

/** `<input type="datetime-local">` wants `YYYY-MM-DDTHH:mm` in local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const TONE: Record<string, string> = {
  live: "border-brand-200 bg-brand-50 text-brand-700",
  scheduled: "border-warning-soft bg-warning-soft text-warning-deep",
  expired: "border-line bg-canvas-deep text-ink-muted",
  hidden: "border-line bg-canvas-deep text-ink-muted",
  always: "border-line bg-canvas text-ink-muted",
};

/**
 * Optional publish window for a block. Both bounds are open by default, so an
 * untouched block behaves exactly as it did before scheduling existed.
 */
export function BlockSchedule({
  block,
  onChange,
}: {
  block: EditorBlock;
  onChange: (patch: Partial<EditorBlock>) => void;
}) {
  const [open, setOpen] = React.useState(Boolean(block.startsAt || block.endsAt));
  const state = scheduleState(block);
  const label = describeSchedule(block);

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 text-[14px] font-medium tracking-[-0.02em] text-ink-soft transition-colors hover:text-ink"
        >
          <CalendarClock className="size-4" aria-hidden />
          Schedule
        </button>
        <span className={cn("rounded-full border px-2.5 py-0.5 font-mono text-[12px] leading-4", TONE[state])}>
          {label}
        </span>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Goes live</span>
            <input
              type="datetime-local"
              className="field"
              value={toLocalInput(block.startsAt)}
              onChange={(e) => onChange({ startsAt: fromLocalInput(e.target.value) })}
            />
          </label>
          <label className="block">
            <span className="field-label">Expires</span>
            <input
              type="datetime-local"
              className="field"
              value={toLocalInput(block.endsAt)}
              onChange={(e) => onChange({ endsAt: fromLocalInput(e.target.value) })}
            />
          </label>
          <p className="font-mono text-[12px] leading-4 text-ink-muted sm:col-span-2">
            Leave a field empty to leave that end open. Times are in your local timezone.
          </p>
        </div>
      )}
    </div>
  );
}
