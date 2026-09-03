"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import type { EffectAssignment, EffectTarget } from "@plink/core/site-schema";
import { cn } from "@plink/core/utils";
import { Modal } from "@plink/ui/modal";
import { EffectPicker } from "@/components/effects";
import { countEffects, targetsForLevel, type EffectScope } from "../_lib/document-ops";

/**
 * The effects affordance for one element of the document — site, page, section
 * or block. One button showing how many targets are assigned; one dialog behind
 * it with a tab per target and the shared `EffectPicker` inside.
 *
 * Targets follow the element's nature (`targetsForLevel`): containers get
 * `background` and `entrance`, a block — the only concrete surface with letters
 * of its own — gets all four.
 *
 * `palette` is the edited site's own `--pl-*` vars, so the swatches preview
 * against the real theme rather than a stand-in (constitution IV.3: the site's
 * theme vocabulary, not the admin's tokens, dresses anything site-shaped).
 */
export function EffectsButton({
  level,
  label,
  effects,
  palette,
  onChange,
  compact,
}: {
  level: EffectScope["level"];
  /** Names the element in the dialog title: "Hero section", "Link block", … */
  label: string;
  effects: EffectAssignment;
  palette?: React.CSSProperties;
  onChange: (target: EffectTarget, id: string | undefined) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const targets = React.useMemo(() => targetsForLevel(level), [level]);
  const [target, setTarget] = React.useState<EffectTarget>(targets[0]);
  const count = countEffects(effects);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTarget(targets[0]);
          setOpen(true);
        }}
        aria-label={`Effects for ${label}`}
        title={`Effects for ${label}`}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-md border text-[13px] font-medium tracking-[-0.02em] transition-colors",
          compact ? "h-8 px-2" : "h-8 px-3",
          count > 0
            ? "border-brand-100 bg-brand-50 text-brand-600 hover:border-brand-200"
            : "border-line bg-surface text-ink-muted hover:border-line-strong/50 hover:bg-canvas-deep hover:text-ink",
        )}
      >
        <Sparkles className="size-3.5" aria-hidden />
        {compact ? null : "Effects"}
        {count > 0 && (
          <span className="rounded-full bg-brand-100 px-1.5 text-[11px] leading-4 text-brand-700">
            {count}
          </span>
        )}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Effects — ${label}`}
        description="Effects are stored on the element itself, so they travel with it through publish and rollback."
        size="lg"
      >
        <div className="flex flex-col gap-4">
          {targets.length > 1 && (
            <div
              role="tablist"
              aria-label="Effect target"
              className="flex flex-wrap gap-1 rounded-md border border-line bg-canvas p-1"
            >
              {targets.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  role="tab"
                  aria-selected={candidate === target}
                  onClick={() => setTarget(candidate)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium tracking-[-0.02em] transition-colors",
                    candidate === target
                      ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-line)]"
                      : "text-ink-muted hover:text-ink",
                  )}
                >
                  {TARGET_LABELS[candidate]}
                  {effects[candidate] && (
                    <span className="size-1.5 rounded-full bg-brand-500" aria-hidden />
                  )}
                </button>
              ))}
            </div>
          )}

          <EffectPicker
            key={target}
            target={target}
            value={effects[target]}
            onChange={(id) => onChange(target, id)}
            palette={palette}
          />
        </div>
      </Modal>
    </>
  );
}

const TARGET_LABELS: Record<EffectTarget, string> = {
  surface: "Surface",
  text: "Text",
  background: "Background",
  entrance: "Entrance",
};
