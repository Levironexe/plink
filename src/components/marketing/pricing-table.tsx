"use client";

import * as React from "react";
import { Check, Sparkles } from "lucide-react";
import { PLANS } from "@/lib/pricing";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
              "rounded-full px-4 py-2 text-[14px] font-semibold transition",
              yearly === opt.id ? "bg-ink text-white" : "text-ink-muted hover:text-ink",
            )}
          >
            {opt.label}
            {opt.id && (
              <span className={cn("ml-1.5 text-[12px]", yearly ? "text-lime" : "text-brand-500")}>−22%</span>
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
                "relative flex flex-col rounded-[28px] border p-7 transition-all duration-300",
                plan.featured
                  ? "border-ink bg-ink text-white shadow-lift lg:-my-3 lg:py-10"
                  : "border-line bg-surface shadow-soft hover:-translate-y-1 hover:shadow-lift",
              )}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-7 inline-flex items-center gap-1.5 rounded-full bg-lime px-3 py-1 text-[12px] font-black tracking-wide text-ink uppercase">
                  <Sparkles className="size-3" aria-hidden />
                  Most popular
                </span>
              )}
              <h3 className={cn("text-[22px] font-extrabold", plan.featured ? "text-white" : "text-ink")}>
                {plan.name}
              </h3>
              <p className={cn("mt-1.5 text-[14.5px] leading-relaxed", plan.featured ? "text-white/65" : "text-ink-muted")}>
                {plan.tagline}
              </p>

              <div className="mt-6 flex items-baseline gap-1.5">
                <span className={cn("text-[44px] leading-none font-extrabold tracking-tight", plan.featured ? "text-white" : "text-ink")}>
                  ${price % 1 === 0 ? price : price.toFixed(2)}
                </span>
                <span className={cn("text-[14px] font-medium", plan.featured ? "text-white/60" : "text-ink-muted")}>
                  /month
                </span>
              </div>
              <p className={cn("mt-1 h-5 text-[13px]", plan.featured ? "text-white/50" : "text-ink-muted")}>
                {plan.monthly > 0 && yearly ? `Billed $${plan.yearly} yearly` : plan.monthly > 0 ? "Billed monthly" : "Free forever"}
              </p>

              <ButtonLink
                href={plan.id === "vip" ? "/signup?plan=vip" : `/signup?plan=${plan.id}`}
                variant={plan.featured ? "lime" : "outline"}
                size="md"
                fullWidth
                className="mt-6"
              >
                {plan.cta}
              </ButtonLink>

              <ul className="mt-7 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full",
                        plan.featured ? "bg-white/15 text-lime" : "bg-brand-100 text-brand-700",
                      )}
                    >
                      <Check className="size-2.5" strokeWidth={3.5} aria-hidden />
                    </span>
                    <span className={cn("text-[14.5px] leading-snug", plan.featured ? "text-white/85" : "text-ink-soft")}>
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
