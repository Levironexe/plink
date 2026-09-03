"use client";

import * as React from "react";
import { ChevronRight, Square, Trash2 } from "lucide-react";
import { blockDefinition } from "@plink/core/blocks";
import type { EffectTarget, SiteBlock } from "@plink/core/site-schema";
import { cn } from "@plink/core/utils";
import { TextField } from "@plink/ui/field";
import { IconButton, MoveButtons } from "./editor-chrome";
import { EffectsButton } from "./effects-button";
import type { BlockPatch } from "../_lib/document-ops";

/**
 * One block inside a section: a collapsed summary row that expands into the
 * four fields every block type shares. `config` stays untouched — it is
 * per-type free-form, seeded from `BLOCK_LIBRARY` defaults on creation, and a
 * per-type form belongs with the block definitions rather than here.
 */
export function BlockCard({
  block,
  index,
  count,
  expanded,
  palette,
  onToggle,
  onChange,
  onMove,
  onDelete,
  onEffect,
}: {
  block: SiteBlock;
  index: number;
  count: number;
  expanded: boolean;
  palette?: React.CSSProperties;
  onToggle: () => void;
  onChange: (patch: BlockPatch) => void;
  onMove: (delta: number) => void;
  onDelete: () => void;
  onEffect: (target: EffectTarget, id: string | undefined) => void;
}) {
  const definition = blockDefinition(block.type);
  const Icon = definition?.icon ?? Square;
  const name = definition?.label ?? block.type;
  const fieldId = React.useId();

  return (
    <div className="rounded-md border border-line bg-surface">
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={`${fieldId}-fields`}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1 py-1 text-left transition-colors hover:bg-canvas-deep"
        >
          <ChevronRight
            className={cn("size-3.5 shrink-0 text-ink-muted transition-transform", expanded && "rotate-90")}
            aria-hidden
          />
          <Icon className="size-4 shrink-0 text-ink-muted" aria-hidden />
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-medium tracking-[-0.02em] text-ink">
              {block.title || block.subtitle || name}
            </span>
            <span className="block truncate text-[12px] leading-4 text-ink-muted">
              {name}
              {block.url ? ` · ${block.url}` : ""}
            </span>
          </span>
        </button>

        <EffectsButton
          compact
          level="block"
          label={`${name} block`}
          effects={block.effects}
          palette={palette}
          onChange={onEffect}
        />
        <MoveButtons what="block" onMove={onMove} atStart={index === 0} atEnd={index === count - 1} />
        <IconButton label={`Delete ${name} block`} onClick={onDelete} destructive>
          <Trash2 className="size-4" aria-hidden />
        </IconButton>
      </div>

      {expanded && (
        <div id={`${fieldId}-fields`} className="grid gap-3 border-t border-line p-3 sm:grid-cols-2">
          <TextField
            label="Title"
            value={block.title}
            onChange={(e) => onChange({ title: e.target.value })}
            maxLength={200}
            placeholder={definition?.defaults.title ?? "Title"}
          />
          <TextField
            label="Subtitle"
            value={block.subtitle}
            onChange={(e) => onChange({ subtitle: e.target.value })}
            maxLength={300}
            placeholder="Supporting line"
          />
          <TextField
            label="URL"
            value={block.url}
            onChange={(e) => onChange({ url: e.target.value })}
            maxLength={2000}
            placeholder="https://…"
            hint={definition?.description}
          />
          <TextField
            label="Image URL"
            // The schema stores `null` for "no image"; an emptied field must
            // reach the document as null, not as "".
            value={block.imageUrl ?? ""}
            onChange={(e) => onChange({ imageUrl: e.target.value.trim() === "" ? null : e.target.value })}
            maxLength={600}
            placeholder="https://…"
          />
        </div>
      )}
    </div>
  );
}
