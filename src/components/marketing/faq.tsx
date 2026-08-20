"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { FAQS } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export function Faq() {
  const [open, setOpen] = React.useState<number | null>(0);
  return (
    <div className="mx-auto w-full max-w-3xl divide-y divide-line overflow-hidden rounded-[26px] border border-line bg-surface">
      {FAQS.map((f, i) => (
        <div key={f.q}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left transition hover:bg-canvas"
          >
            <span className="text-[16.5px] font-bold text-ink">{f.q}</span>
            <Plus
              className={cn("size-5 shrink-0 text-ink-muted transition-transform duration-300", open === i && "rotate-45")}
              aria-hidden
            />
          </button>
          <div
            className={cn(
              "grid transition-all duration-300 ease-out",
              open === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            )}
          >
            <div className="overflow-hidden">
              <p className="px-6 pb-6 text-[15.5px] leading-relaxed text-ink-soft">{f.a}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
