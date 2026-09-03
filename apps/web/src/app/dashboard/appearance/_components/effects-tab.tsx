"use client";

import * as React from "react";
import { Check, Sparkles, TriangleAlert } from "lucide-react";
import {
  EFFECT_GROUPS, EFFECT_NONE, EFFECTS, effectById, effectsInGroup,
} from "@plink/effects/registry";
import { buttonCss, buttonEffectVars, pageEffectVars, type ThemeShape } from "@plink/core/themes";
import { cn } from "@plink/core/utils";
import { EffectPicker } from "@/components/effects";
import type { EffectTarget } from "@plink/core/site-schema";

/**
 * The effect picker. Every swatch is a real button wearing the creator's own
 * palette and running the real effect, so what they see here is exactly what
 * lands on their page — no illustrations to keep in sync.
 *
 * Four targets, one per column on `Theme`: the surface section at the top has
 * driven `buttonEffect` since the beginning and is unchanged; background, text
 * and entrance follow, each reaching the shared `EffectPicker` for its target.
 */
export function EffectsTab({
  theme,
  patch,
}: {
  theme: ThemeShape;
  patch: (next: Partial<ThemeShape>) => void;
}) {
  const active = effectById(theme.buttonEffect);

  // The page's own palette and backdrop, so every swatch below previews in the
  // colours it will actually wear. Page-level effects read `pageEffectVars`
  // rather than the button palette — see the profile-effects spike.
  const pagePalette: React.CSSProperties = {
    ...pageEffectVars(theme),
    background:
      theme.bgType === "gradient"
        ? `linear-gradient(160deg, ${theme.bgColor}, ${theme.bgColorTwo})`
        : theme.bgColor,
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-line bg-surface p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-bold text-ink">Effect</h2>
            <p className="mt-1 text-[14px] text-ink-muted">
              Applies to every link and card on your page. Hover a swatch to feel it.
            </p>
          </div>
          {active.id !== EFFECT_NONE && (
            <button
              onClick={() => patch({ buttonEffect: EFFECT_NONE })}
              className="rounded-lg border border-line px-3 py-2 text-[13px] font-semibold text-ink-muted transition hover:border-ink hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>

        <div className="mt-5">
          <EffectSwatch
            theme={theme}
            effect={effectById(EFFECT_NONE)}
            selected={active.id === EFFECT_NONE}
            onSelect={() => patch({ buttonEffect: EFFECT_NONE })}
          />
        </div>
      </section>

      {EFFECT_GROUPS.map((group) => {
        const effects = effectsInGroup(group);
        if (effects.length === 0) return null;
        return (
          <section key={group} className="rounded-xl border border-line bg-surface p-5 shadow-soft sm:p-6">
            <h2 className="text-[17px] font-bold text-ink">{group}</h2>
            <p className="mt-1 text-[14px] text-ink-muted">{GROUP_BLURB[group]}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {effects.map((effect) => (
                <EffectSwatch
                  key={effect.id}
                  theme={theme}
                  effect={effect}
                  selected={active.id === effect.id}
                  onSelect={() => patch({ buttonEffect: effect.id })}
                />
              ))}
            </div>
          </section>
        );
      })}

      <PageEffectSection
        title="Background"
        description="Paints behind your whole page, under every block. Nothing here takes a tap."
        target="background"
        value={theme.bgEffect}
        palette={pagePalette}
        onChange={(id) => patch({ bgEffect: id ?? EFFECT_NONE })}
      />

      <PageEffectSection
        title="Text"
        description="Styles your display name and any section headings — not your links or body text."
        target="text"
        value={theme.textEffect}
        palette={pagePalette}
        onChange={(id) => patch({ textEffect: id ?? EFFECT_NONE })}
      />

      <PageEffectSection
        title="Entrance"
        description="Your blocks animate in as they scroll into view. Plays once, then stays put."
        target="entrance"
        value={theme.entranceEffect}
        palette={pagePalette}
        onChange={(id) => patch({ entranceEffect: id ?? EFFECT_NONE })}
      />

      <p className="flex items-start gap-2 px-1 text-[13px] leading-relaxed text-ink-muted">
        <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
        Visitors who ask their device to reduce motion see your page without animation.
        Every effect is built to look right standing still.
      </p>
    </div>
  );
}

/**
 * One page-level target, in the same panel chrome as the surface sections
 * above it. All DESIGN.md tokens — the creator's colours live inside the
 * swatches, never in the dashboard around them.
 */
function PageEffectSection({
  title,
  description,
  target,
  value,
  palette,
  onChange,
}: {
  title: string;
  description: string;
  target: EffectTarget;
  value: string;
  palette: React.CSSProperties;
  onChange: (id: string | undefined) => void;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-soft sm:p-6">
      <h2 className="text-[17px] font-bold text-ink">{title}</h2>
      <p className="mt-1 text-[14px] text-ink-muted">{description}</p>
      <div className="mt-5">
        <EffectPicker target={target} value={value} onChange={onChange} palette={palette} />
      </div>
    </section>
  );
}

const GROUP_BLURB: Record<string, string> = {
  Ambient: "Always moving, quietly. Good for drawing the eye to a whole page.",
  Hover: "Still until someone reaches for it. The safest choice for busy pages.",
  Pointer: "Follows the cursor. Falls back to a still surface on touch screens.",
  Bold: "Loud on purpose. Best on a dark theme with one or two links.",
};

function EffectSwatch({
  theme,
  effect,
  selected,
  onSelect,
}: {
  theme: ThemeShape;
  effect: (typeof EFFECTS)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group rounded-xl border-2 p-3 text-left transition",
        selected ? "border-ink bg-canvas-deep" : "border-line hover:border-line-strong",
      )}
    >
      {/* The swatch sits on the creator's own background so the effect reads
          the way it will in the wild, not against dashboard white. */}
      <div
        className="grid h-16 place-items-center rounded-lg p-2"
        style={{
          background:
            theme.bgType === "gradient"
              ? `linear-gradient(160deg, ${theme.bgColor}, ${theme.bgColorTwo})`
              : theme.bgColor,
        }}
      >
        <div
          className={cn(
            "grid h-9 w-full max-w-[190px] place-items-center px-3 text-[13px] font-semibold",
            effect.className && "pl-fx",
            effect.className,
          )}
          style={{ ...buttonCss(theme), ...buttonEffectVars(theme) }}
        >
          <span className="truncate">{effect.name}</span>
        </div>
      </div>

      <div className="mt-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[14px] font-bold text-ink">
            {effect.name}
            {effect.ambient && <Sparkles className="size-3 shrink-0 text-brand-500" aria-label="Animates on its own" />}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">{effect.description}</p>
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
