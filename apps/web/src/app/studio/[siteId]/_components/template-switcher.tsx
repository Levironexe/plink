"use client";

import { Check } from "lucide-react";
import { SITE_TEMPLATES, type SiteTemplateId } from "@plink/core/site-schema";
import { cn } from "@plink/core/utils";

/**
 * The three templates the renderer ships, as one radio group. This is the §8
 * DoD claim made concrete: the same document, no per-client code, three
 * structurally different websites — so the switcher changes exactly one field
 * and never touches the content underneath.
 */
const TEMPLATE_BLURBS: Record<SiteTemplateId, { name: string; blurb: string }> = {
  editorial: {
    name: "Editorial",
    blurb: "A masthead and a reading column. Best for writing, studios and personal sites.",
  },
  storefront: {
    name: "Storefront",
    blurb: "A top bar and product grids. Best when the shop is the point.",
  },
  portfolio: {
    name: "Portfolio",
    blurb: "A sidebar and a gallery rhythm. Best for work that should be seen large.",
  },
};

export function TemplateSwitcher({
  value,
  pending,
  onChange,
}: {
  value: SiteTemplateId;
  pending?: boolean;
  onChange: (template: SiteTemplateId) => void;
}) {
  return (
    <fieldset disabled={pending} className="disabled:opacity-60">
      <legend className="sr-only">Site template</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {SITE_TEMPLATES.map((template) => {
          const current = template === value;
          const { name, blurb } = TEMPLATE_BLURBS[template];
          return (
            <button
              key={template}
              type="button"
              aria-pressed={current}
              onClick={() => onChange(template)}
              className={cn(
                "rounded-md border p-3 text-left transition-colors",
                current
                  ? "border-ink bg-canvas-deep shadow-[0_0_0_1px_var(--color-ink)]"
                  : "border-line bg-surface hover:border-line-strong/50 hover:bg-canvas-deep",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-medium tracking-[-0.02em] text-ink">{name}</span>
                {current && (
                  <span className="grid size-4 shrink-0 place-items-center rounded-full bg-ink text-white">
                    <Check className="size-2.5" strokeWidth={3} aria-hidden />
                  </span>
                )}
              </span>
              <span className="mt-1 block text-[12.5px] leading-4 text-ink-muted">{blurb}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
