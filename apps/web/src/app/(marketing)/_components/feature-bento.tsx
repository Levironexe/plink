import Link from "next/link";
import {
  Link2, Store, Mails, Newspaper, ChartColumn, Palette, CalendarDays, ArrowUpRight,
} from "lucide-react";
import { cn } from "@plink/core/utils";
import { Reveal } from "./reveal";

const FEATURES = [
  {
    icon: Link2,
    title: "Link in bio",
    body: "Unlimited links, headers, embeds and galleries. Reorder by dragging. Schedule what goes live and when it expires.",
    span: "md:col-span-2",
  },
  {
    icon: Store,
    title: "Creator store",
    body: "Sell digital products, presets and 1:1 sessions. Paid out straight to your own account.",
  },
  {
    icon: Mails,
    title: "Email list",
    body: "Capture emails on your page, then broadcast to them. Export any time — the list is yours.",
  },
  {
    icon: CalendarDays,
    title: "Bookings",
    body: "Publish your availability and let people book a slot without a back-and-forth thread.",
  },
  {
    icon: Newspaper,
    title: "Media kit",
    body: "A rate card and audience stats, built from your real numbers, ready to send to brands.",
  },
  {
    icon: ChartColumn,
    title: "Analytics",
    body: "Views, clicks, click-through rate, top links and where your traffic actually comes from.",
  },
  {
    icon: Palette,
    title: "Themes with real control",
    body: "Start from a preset, then take over colours, fonts, button shapes and backgrounds.",
    span: "md:col-span-2",
  },
];

export function FeatureBento() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {FEATURES.map((f, i) => (
        <Reveal key={f.title} delay={i * 60} className={cn(f.span)}>
          <article className="group h-full rounded-xl border border-line bg-surface p-6 shadow-soft transition-shadow duration-200 hover:shadow-lift">
            <div className="mb-5 grid size-9 place-items-center rounded-md border border-line bg-canvas text-ink">
              <f.icon className="size-[18px]" aria-hidden />
            </div>
            <h3 className="text-[16px] font-medium tracking-[-0.02em] text-ink">{f.title}</h3>
            <p className="mt-2 max-w-md text-[14px] leading-5 tracking-[-0.02em] text-ink-soft">{f.body}</p>
          </article>
        </Reveal>
      ))}
      <Reveal delay={420} className="md:col-span-1">
        <Link
          href="/signup"
          className="group flex h-full flex-col justify-between rounded-xl bg-ink p-6 text-white transition-colors duration-200 hover:bg-ink/90"
        >
          <span className="text-[16px] font-medium tracking-[-0.02em]">Start building</span>
          <span className="mt-8 inline-flex items-center gap-1.5 font-mono text-[12px] leading-4 text-white/60 transition-colors group-hover:text-white">
            It&rsquo;s free
            <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
          </span>
        </Link>
      </Reveal>
    </div>
  );
}
