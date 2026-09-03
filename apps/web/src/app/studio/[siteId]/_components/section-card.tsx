"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { BLOCK_LIBRARY, type BlockDefinition, type BlockType } from "@plink/core/blocks";
import type { EffectTarget, SiteSection } from "@plink/core/site-schema";
import { Button } from "@plink/ui/button";
import { ChoiceDialog, IconButton, MoveButtons, SECTION_KIND_LABELS, type Choice } from "./editor-chrome";
import { EffectsButton } from "./effects-button";
import { BlockCard } from "./block-card";
import { LIMITS, type BlockPatch } from "../_lib/document-ops";

/** `BLOCK_LIBRARY` as picker choices, filed under its own categories. */
const BLOCK_CHOICES: ReadonlyArray<Choice<BlockType>> = BLOCK_LIBRARY.map((definition) => ({
  id: definition.type,
  label: definition.label,
  blurb: definition.description,
  icon: definition.icon,
  group: definition.category,
}));

const BLOCK_BY_TYPE = new Map(BLOCK_LIBRARY.map((definition) => [definition.type, definition]));

/**
 * One section of the active page: its kind and title, its reorder and delete
 * verbs, its effects, and the list of blocks inside it.
 */
export function SectionCard({
  section,
  index,
  count,
  palette,
  expandedBlockId,
  onExpandBlock,
  onRename,
  onMove,
  onDelete,
  onEffect,
  onAddBlock,
  onBlockChange,
  onBlockMove,
  onBlockDelete,
  onBlockEffect,
}: {
  section: SiteSection;
  index: number;
  count: number;
  palette?: React.CSSProperties;
  expandedBlockId: string | null;
  onExpandBlock: (blockId: string | null) => void;
  onRename: (title: string) => void;
  onMove: (delta: number) => void;
  onDelete: () => void;
  onEffect: (target: EffectTarget, id: string | undefined) => void;
  onAddBlock: (definition: BlockDefinition) => void;
  onBlockChange: (blockId: string, patch: BlockPatch) => void;
  onBlockMove: (blockId: string, delta: number) => void;
  onBlockDelete: (blockId: string) => void;
  onBlockEffect: (blockId: string, target: EffectTarget, id: string | undefined) => void;
}) {
  const [adding, setAdding] = React.useState(false);
  const kindLabel = SECTION_KIND_LABELS.get(section.kind) ?? section.kind;
  const full = section.blocks.length >= LIMITS.blocksPerSection;

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow shrink-0 rounded-full border border-line bg-canvas px-2 py-0.5 uppercase">
          {kindLabel}
        </span>
        <input
          value={section.title}
          onChange={(e) => onRename(e.target.value)}
          maxLength={200}
          aria-label={`${kindLabel} section title`}
          placeholder="Section title (optional)"
          className="field h-9 min-w-0 flex-1 border-transparent bg-transparent px-2 font-medium hover:border-line"
        />
        <EffectsButton
          compact
          level="section"
          label={`${section.title || kindLabel} section`}
          effects={section.effects}
          palette={palette}
          onChange={onEffect}
        />
        <MoveButtons what="section" onMove={onMove} atStart={index === 0} atEnd={index === count - 1} />
        <IconButton label={`Delete ${kindLabel} section`} onClick={onDelete} destructive>
          <Trash2 className="size-4" aria-hidden />
        </IconButton>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {section.blocks.map((block, blockIndex) => (
          <BlockCard
            key={block.id}
            block={block}
            index={blockIndex}
            count={section.blocks.length}
            expanded={expandedBlockId === block.id}
            palette={palette}
            onToggle={() => onExpandBlock(expandedBlockId === block.id ? null : block.id)}
            onChange={(patch) => onBlockChange(block.id, patch)}
            onMove={(delta) => onBlockMove(block.id, delta)}
            onDelete={() => onBlockDelete(block.id)}
            onEffect={(target, id) => onBlockEffect(block.id, target, id)}
          />
        ))}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAdding(true)}
          disabled={full}
          className="justify-center border border-dashed border-line"
        >
          <Plus className="size-4" aria-hidden />
          {full ? `Section is full (${LIMITS.blocksPerSection} blocks)` : "Add block"}
        </Button>
      </div>

      <ChoiceDialog
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a block"
        description={`Into the ${section.title || kindLabel} section.`}
        choices={BLOCK_CHOICES}
        onPick={(type) => {
          const definition = BLOCK_BY_TYPE.get(type);
          if (definition) onAddBlock(definition);
        }}
      />
    </section>
  );
}
