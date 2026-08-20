"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, Copy, Eye, EyeOff, GripVertical, MousePointerClick, Trash2 } from "lucide-react";
import { blockDefinition } from "@/lib/blocks";
import { cn, compactNumber, hostOf } from "@/lib/utils";
import { BlockFields } from "./block-fields";
import type { EditorBlock } from "./types";

export function BlockCard({
  block,
  expanded,
  onToggleExpand,
  onChange,
  onDelete,
  onDuplicate,
}: {
  block: EditorBlock;
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: (patch: Partial<EditorBlock>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const def = blockDefinition(block.type);
  const Icon = def?.icon;

  const summary =
    block.title ||
    (block.type === "text" ? block.subtitle : "") ||
    def?.label ||
    "Block";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "rounded-[20px] border bg-surface transition-shadow",
        isDragging ? "z-20 border-brand-400 shadow-lift" : "border-line shadow-soft",
        !block.visible && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2 p-3">
        <button
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${summary}`}
          className="shrink-0 cursor-grab touch-none rounded-lg p-1.5 text-ink-muted transition hover:bg-black/5 hover:text-ink active:cursor-grabbing"
        >
          <GripVertical className="size-[18px]" />
        </button>

        <button
          onClick={onToggleExpand}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left"
        >
          {Icon && (
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-canvas text-ink-soft">
              <Icon className="size-[17px]" aria-hidden />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14.5px] font-bold text-ink">{summary}</span>
            <span className="block truncate text-[12.5px] text-ink-muted">
              {block.url ? hostOf(block.url) || block.url : (def?.label ?? "")}
            </span>
          </span>
        </button>

        {block.clicks > 0 && (
          <span
            className="hidden shrink-0 items-center gap-1 rounded-full bg-canvas px-2.5 py-1 text-[12px] font-bold text-ink-muted sm:inline-flex"
            title={`${block.clicks} clicks`}
          >
            <MousePointerClick className="size-3" aria-hidden />
            {compactNumber(block.clicks)}
          </span>
        )}

        <button
          onClick={() => onChange({ visible: !block.visible })}
          aria-label={block.visible ? "Hide this block" : "Show this block"}
          className="shrink-0 rounded-lg p-2 text-ink-muted transition hover:bg-black/5 hover:text-ink"
        >
          {block.visible ? <Eye className="size-[17px]" /> : <EyeOff className="size-[17px]" />}
        </button>

        <button
          onClick={onToggleExpand}
          aria-label={expanded ? "Collapse" : "Edit"}
          className="shrink-0 rounded-lg p-2 text-ink-muted transition hover:bg-black/5 hover:text-ink"
        >
          <ChevronDown className={cn("size-[17px] transition-transform", expanded && "rotate-180")} />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-line px-4 pt-4 pb-4">
          <BlockFields block={block} onChange={onChange} />
          <div className="mt-5 flex items-center justify-between gap-2 border-t border-line pt-4">
            <button
              onClick={onDuplicate}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13.5px] font-semibold text-ink-muted transition hover:bg-black/5 hover:text-ink"
            >
              <Copy className="size-4" /> Duplicate
            </button>
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13.5px] font-semibold text-coral transition hover:bg-coral/10"
            >
              <Trash2 className="size-4" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
