"use client";

import * as React from "react";
import { Modal } from "@plink/ui/modal";
import { BLOCK_LIBRARY, type BlockDefinition } from "@plink/core/blocks";
import { cn } from "@plink/core/utils";

const CATEGORIES = ["Essentials", "Content", "Monetize", "Grow"] as const;

export function AddBlockModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (def: BlockDefinition) => void;
}) {
  const [category, setCategory] = React.useState<(typeof CATEGORIES)[number] | "All">("All");

  const items = BLOCK_LIBRARY.filter((b) => category === "All" || b.category === category);

  return (
    <Modal open={open} onClose={onClose} title="Add a block" description="Pick what to put on your page." size="lg">
      <div className="flex flex-wrap gap-1.5">
        {(["All", ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold transition",
              category === c ? "bg-ink text-white" : "bg-canvas text-ink-muted hover:text-ink",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
        {items.map((def) => (
          <button
            key={def.type}
            onClick={() => {
              onPick(def);
              onClose();
            }}
            className="group flex items-start gap-3.5 rounded-2xl border border-line bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:border-ink hover:shadow-soft"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-canvas text-ink transition group-hover:bg-ink group-hover:text-white">
              <def.icon className="size-[19px]" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold text-ink">{def.label}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-ink-muted">{def.description}</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
