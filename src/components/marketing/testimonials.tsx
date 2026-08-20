import { generatedAvatar } from "@/lib/avatar";
import { Reveal } from "./reveal";

const QUOTES = [
  {
    quote:
      "I replaced four tools with one page. My store, my newsletter and my links all live in the same place now — and my click-through rate doubled.",
    name: "Maya Osei",
    role: "Product designer · 284k",
    seed: "mayabuilds",
  },
  {
    quote:
      "The media kit alone paid for itself. I sent a link instead of a PDF and closed a brand deal the same week.",
    name: "Kira Lund",
    role: "Strength coach · 118k",
    seed: "kiralifts",
  },
  {
    quote:
      "Setup took about ninety seconds. I was worried it'd look like every other link page — it doesn't.",
    name: "ATLAS",
    role: "Producer · 61k",
    seed: "atlas.sound",
  },
  {
    quote:
      "Being able to see exactly which recipe link people tap changed how I plan content. That data used to be invisible.",
    name: "Noah Reyes",
    role: "Food creator · 402k",
    seed: "noahcooks",
  },
];

export function Testimonials() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {QUOTES.map((q, i) => (
        <Reveal key={q.name} delay={i * 70}>
          <figure className="flex h-full flex-col justify-between rounded-[26px] border border-line bg-surface p-7 shadow-soft">
            <blockquote className="text-[17px] leading-relaxed font-medium text-ink">
              “{q.quote}”
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={generatedAvatar(q.seed)} alt="" className="size-11 rounded-full" />
              <div>
                <p className="text-[14.5px] font-bold text-ink">{q.name}</p>
                <p className="text-[13px] text-ink-muted">{q.role}</p>
              </div>
            </figcaption>
          </figure>
        </Reveal>
      ))}
    </div>
  );
}
