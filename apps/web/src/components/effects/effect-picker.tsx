"use client";

import * as React from "react";
import { Check, Sparkles } from "lucide-react";
import type { EffectTarget } from "@plink/core/site-schema";
import {
  EFFECT_NONE,
  effectsForTarget,
  type EffectDefinition,
} from "@plink/effects/registry";
import { cn } from "@plink/core/utils";

/**
 * The per-target effect picker for the studio: one swatch per effect, each a
 * live element actually running the effect, following the Appearance tab's
 * swatch-grid pattern. Admin chrome is all DESIGN.md tokens; the previews
 * receive their `--pl-*` palette from the caller (the site being edited) and
 * fall back to token-derived defaults, so nothing here hardcodes a colour.
 */
export function EffectPicker({
  target,
  value,
  onChange,
  palette,
}: {
  target: EffectTarget;
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  /** `--pl-*` custom properties (and optionally a background) for the previews. */
  palette?: React.CSSProperties;
}) {
  const effects = effectsForTarget(target);
  const known = value && value !== EFFECT_NONE && effects.some((e) => e.id === value)
    ? value
    : undefined;
  // Group like the Appearance tab. Each target currently maps to one group,
  // but the registry stays free to split one later without touching this.
  const groups = [...new Set(effects.map((effect) => effect.group))];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <EffectSwatch
          target={target}
          effect={null}
          palette={palette}
          selected={known === undefined}
          onSelect={() => onChange(undefined)}
        />
      </div>

      {groups.map((group) => (
        <section key={group}>
          <h3 className="text-[14px] font-bold text-ink">{group}</h3>
          <p className="mt-0.5 text-[13px] text-ink-muted">{TARGET_BLURB[target]}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {effects
              .filter((effect) => effect.group === group)
              .map((effect) => (
                <EffectSwatch
                  key={effect.id}
                  target={target}
                  effect={effect}
                  palette={palette}
                  selected={known === effect.id}
                  onSelect={() => onChange(effect.id)}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const TARGET_BLURB: Record<EffectTarget, string> = {
  surface: "Dresses the element itself — hover a swatch to feel it.",
  text: "Styles the letters directly. Selection and copy still work.",
  background: "Paints behind the content. Patterns hold still; washes drift.",
  entrance: "Plays once as the element scrolls into view. Hover to replay.",
};

/*
 * Default preview palette, derived entirely from the admin design tokens so
 * the picker never hardcodes a colour. A caller editing a real site passes
 * that site's `--pl-*` vars instead and these fall away.
 */
const DEFAULT_PREVIEW_PALETTE: React.CSSProperties = {
  "--pl-bg": "var(--color-canvas-deep)",
  "--pl-fg": "var(--color-ink)",
  "--pl-accent": "var(--color-brand-500)",
  "--pl-fg-12": "color-mix(in srgb, var(--color-ink) 12%, transparent)",
  "--pl-fg-25": "color-mix(in srgb, var(--color-ink) 25%, transparent)",
  "--pl-fg-45": "color-mix(in srgb, var(--color-ink) 45%, transparent)",
  "--pl-accent-30": "color-mix(in srgb, var(--color-brand-500) 30%, transparent)",
  "--pl-accent-60": "color-mix(in srgb, var(--color-brand-500) 60%, transparent)",
} as React.CSSProperties;

function EffectSwatch({
  target,
  effect,
  palette,
  selected,
  onSelect,
}: {
  target: EffectTarget;
  /** `null` renders the "None" swatch. */
  effect: EffectDefinition | null;
  palette?: React.CSSProperties;
  selected: boolean;
  onSelect: () => void;
}) {
  // Entrance effects are one-shot; remounting the sample replays them.
  const [replay, setReplay] = React.useState(0);

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => {
        if (target === "entrance" && effect) setReplay((n) => n + 1);
      }}
      aria-pressed={selected}
      className={cn(
        "group rounded-xl border-2 p-3 text-left transition",
        selected ? "border-ink bg-canvas-deep" : "border-line hover:border-line-strong",
      )}
    >
      {/* The live stage. Decorative — the name and blurb below carry the meaning.
          Colour arrives by inheritance so effect classes (gradient text and
          friends) can override it; an inline colour on the sample would win
          over the class and break them. */}
      <div
        aria-hidden
        className="grid h-16 place-items-center overflow-hidden rounded-lg p-2"
        style={{
          background: "var(--pl-bg)",
          color: "var(--pl-fg)",
          ...DEFAULT_PREVIEW_PALETTE,
          ...palette,
        }}
      >
        <SwatchSample key={replay} target={target} className={effect?.className ?? ""} />
      </div>

      <div className="mt-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[14px] font-bold text-ink">
            {effect?.name ?? "None"}
            {effect?.ambient && (
              <Sparkles
                className="size-3 shrink-0 text-brand-500"
                aria-label="Animates on its own"
              />
            )}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">
            {effect?.description ?? "The plain element, exactly as it is."}
          </p>
        </div>
        {selected && (
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink text-white">
            <Check className="size-3" strokeWidth={3} aria-hidden />
          </span>
        )}
      </div>
    </button>
  );
}

/** A live element of the right kind for the target, wearing the real effect. */
function SwatchSample({ target, className }: { target: EffectTarget; className: string }) {
  const fx = className ? cn("pl-fx", className) : undefined;

  if (target === "text") {
    return (
      <div className={cn("max-w-full truncate px-1 text-[15px] font-semibold", fx)}>
        Every word alive
      </div>
    );
  }

  if (target === "background") {
    return (
      <div className={cn("grid h-12 w-full place-items-center rounded-md", fx)}>
        <span className="text-[12px] font-semibold">Content on top</span>
      </div>
    );
  }

  if (target === "entrance") {
    return (
      <div
        data-entered=""
        className={cn("flex w-full max-w-[190px] flex-col gap-1", fx)}
      >
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="h-3 rounded-full"
            style={{
              background: "var(--pl-fg-25)",
              width: `${100 - row * 22}%`,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid h-9 w-full max-w-[190px] place-items-center rounded-[10px] px-3 text-[13px] font-semibold",
        fx,
      )}
      style={{
        background: "var(--color-surface)",
        boxShadow: "inset 0 0 0 1px var(--pl-fg-12)",
      }}
    >
      <span className="truncate">Surface</span>
    </div>
  );
}
