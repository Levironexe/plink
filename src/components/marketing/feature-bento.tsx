import Link from "next/link";
import {
  Link2, Store, Mails, Newspaper, ChartColumn, Palette, ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

const FEATURES = [
  {
    icon: Link2,
    title: "Link in bio",
    body: "Unlimited links, headers, embeds and galleries. Reorder by dragging. Schedule what goes live.",
    tint: "from-brand-100 to-brand-50",
    accent: "text-brand-600",
    span: "md:col-span-2",
  },
  {
    icon: Store,
    title: "Creator store",
    body: "Sell digital products, presets and 1:1 sessions. Keep 100% on Pro.",
    tint: "from-[#fff0e6] to-[#fffaf5]",
    accent: "text-[#c2410c]",
  },
  {
    icon: Mails,
    title: "Email list",
    body: "Capture emails right on your page. Export any time — the list is yours.",
    tint: "from-[#e9fbef] to-[#f6fff9]",
    accent: "text-[#15803d]",
  },
  {
    icon: Newspaper,
    title: "Media kit",
    body: "Auto-built rate card and audience stats to send to brands.",
    tint: "from-[#eef4ff] to-[#f7faff]",
    accent: "text-[#1d4ed8]",
  },
  {
    icon: ChartColumn,
    title: "Analytics",
    body: "Views, clicks, click-through rate, top links and where people came from.",
    tint: "from-[#fdeef6] to-[#fff8fc]",
    accent: "text-[#be185d]",
  },
  {
    icon: Palette,
    title: "Themes that don’t look templated",
    body: "12 presets, or take full control of colours, fonts, button shapes and backgrounds.",
    tint: "from-[#f4f2ef] to-[#fbfaf8]",
    accent: "text-ink",
    span: "md:col-span-2",
  },
];

export function FeatureBento() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {FEATURES.map((f, i) => (
        <Reveal key={f.title} delay={i * 60} className={cn(f.span)}>
          <article
            className={cn(
              "group relative h-full overflow-hidden rounded-[26px] border border-line bg-gradient-to-br p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift sm:p-7",
              f.tint,
            )}
          >
            <div className={cn("mb-5 grid size-11 place-items-center rounded-2xl bg-white/80 shadow-soft", f.accent)}>
              <f.icon className="size-[21px]" aria-hidden />
            </div>
            <h3 className="text-[19px] font-bold text-ink">{f.title}</h3>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-ink-soft">{f.body}</p>
          </article>
        </Reveal>
      ))}
      <Reveal delay={360} className="md:col-span-1">
        <Link
          href="/signup"
          className="group flex h-full flex-col justify-between rounded-[26px] bg-ink p-6 text-white transition-all duration-300 hover:-translate-y-1 hover:bg-brand-600 sm:p-7"
        >
          <span className="text-[19px] font-bold">Start building</span>
          <span className="mt-8 inline-flex items-center gap-2 text-[15px] font-semibold text-white/70 transition group-hover:text-white">
            It’s free
            <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
          </span>
        </Link>
      </Reveal>
    </div>
  );
}
