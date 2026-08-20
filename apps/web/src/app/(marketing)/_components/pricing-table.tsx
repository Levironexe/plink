"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { PLANS } from "@plink/core/pricing";
import { ButtonLink } from "@plink/ui/button";
import { cn } from "@plink/core/utils";

export function PricingTable({ compact = false }: { compact?: boolean }) {
  const [yearly, setYearly] = React.useState(true);

  return (
    <div className="flex flex-col items-center">
      <div className="inline-flex items-center gap-1 rounded-full border border-line bg-surface p-1 shadow-soft">
        {[
          { id: false, label: "Monthly" },
          { id: true, label: "Yearly" },
        ].map((opt) => (
          <button
            key={String(opt.id)}
            onClick={() => setYearly(opt.id)}
            aria-pressed={yearly === opt.id}
            className={cn(
              "rounded-full px-4 py-1.5 text-[14px] font-medium tracking-[-0.02em] transition-colors",
              yearly === opt.id ? "bg-ink text-white" : "text-ink-muted hover:text-ink",
            )}
          >
            {opt.label}
            {opt.id && (
              <span className={cn("ml-1.5 font-mono text-[12px]", yearly ? "text-white/70" : "text-ink-muted")}>−22%</span>
            )}
          </button>
        ))}
      </div>

      <div className={cn("mt-10 grid w-full gap-5", compact ? "lg:grid-cols-3" : "lg:grid-cols-3")}>
        {PLANS.map((plan) => {
          const price = yearly ? plan.yearly / 12 : plan.monthly;
          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-xl border p-8 transition-shadow duration-200",
                plan.featured
                  ? "border-ink bg-ink text-white shadow-lift"
                  : "border-line bg-surface shadow-soft hover:shadow-lift",
              )}
            >
              {plan.featured && (
                <span className="absolute -top-2.5 left-8 inline-flex items-center rounded-full bg-white px-2.5 py-0.5 font-mono text-[12px] leading-4 text-ink">
                  Most popular
                </span>
              )}
              <h3 className={cn("text-[20px] font-semibold tracking-[-0.03em]", plan.featured ? "text-white" : "text-ink")}>
                {plan.name}
              </h3>
              <p className={cn("mt-1.5 text-[14px] leading-5 tracking-[-0.02em]", plan.featured ? "text-white/60" : "text-ink-muted")}>
                {plan.tagline}
              </p>

              <div className="mt-6 flex items-baseline gap-1.5">
                <span className={cn("text-[40px] leading-none font-semibold tracking-[-0.045em]", plan.featured ? "text-white" : "text-ink")}>
                  ${price % 1 === 0 ? price : price.toFixed(2)}
                </span>
                <span className={cn("font-mono text-[12px]", plan.featured ? "text-white/60" : "text-ink-muted")}>
                  /month
                </span>
              </div>
              <p className={cn("mt-1.5 h-5 font-mono text-[12px] leading-4", plan.featured ? "text-white/50" : "text-ink-muted")}>
                {plan.monthly > 0 && yearly ? `Billed $${plan.yearly} yearly` : plan.monthly > 0 ? "Billed monthly" : "Free plan"}
              </p>

              <ButtonLink
                href={plan.id === "vip" ? "/signup?plan=vip" : `/signup?plan=${plan.id}`}
                variant={plan.featured ? "secondary" : "outline"}
                size="md"
                fullWidth
                className="mt-7"
              >
                {plan.cta}
              </ButtonLink>

              <ul className="mt-7 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full",
                        plan.featured ? "bg-white/15 text-white" : "bg-canvas-deep text-ink",
                      )}
                    >
                      <Check className="size-2.5" strokeWidth={3} aria-hidden />
                    </span>
                    <span className={cn("text-[14px] leading-5 tracking-[-0.02em]", plan.featured ? "text-white/80" : "text-ink-soft")}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
