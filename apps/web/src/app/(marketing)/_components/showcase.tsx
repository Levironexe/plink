import { Check } from "lucide-react";
import { cn, formatMoney } from "@plink/core/utils";
import { generatedAvatar } from "@plink/core/avatar";
import { Reveal } from "./reveal";
import { Eyebrow } from "./section";
import { ButtonLink } from "@plink/ui/button";
import { THEME_PRESETS } from "@plink/core/themes";

function Row({
  eyebrow, title, body, points, visual, flip, cta,
}: {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  visual: React.ReactNode;
  flip?: boolean;
  cta: { href: string; label: string };
}) {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
      <Reveal className={cn(flip && "lg:order-2")}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 className="mt-5 text-[clamp(1.8rem,3.6vw,2.6rem)] leading-[1.06] font-semibold text-ink">{title}</h3>
        <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-ink-soft">{body}</p>
        <ul className="mt-6 space-y-3">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-3 text-[15.5px] text-ink-soft">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
                <Check className="size-3" strokeWidth={3} aria-hidden />
              </span>
              {p}
            </li>
          ))}
        </ul>
        <ButtonLink href={cta.href} variant="ink" className="mt-8">
          {cta.label}
        </ButtonLink>
      </Reveal>
      <Reveal delay={120} className={cn(flip && "lg:order-1")}>
        {visual}
      </Reveal>
    </div>
  );
}

function ThemeVisual() {
  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-soft">
      <p className="font-mono text-[12px] leading-4 text-ink-muted">Themes</p>
      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {THEME_PRESETS.map((t, i) => (
          <div key={t.id} className="group">
            <div
              className={cn(
                "aspect-[3/4] rounded-2xl border-2 p-2 transition-transform duration-300 group-hover:-translate-y-1",
                i === 0 ? "border-ink" : "border-transparent",
              )}
              style={{
                backgroundImage:
                  t.values.bgType === "gradient"
                    ? `linear-gradient(160deg, ${t.values.bgColor}, ${t.values.bgColorTwo})`
                    : undefined,
                backgroundColor: t.values.bgType !== "gradient" ? t.values.bgColor : undefined,
              }}
            >
              <div className="mx-auto mt-2 size-5 rounded-full" style={{ background: t.values.textColor, opacity: 0.85 }} />
              <div className="mx-auto mt-2 h-1.5 w-8 rounded-full" style={{ background: t.values.textColor, opacity: 0.45 }} />
              <div className="mt-3 space-y-1.5">
                {[0, 1, 2].map((k) => (
                  <div
                    key={k}
                    className="h-3"
                    style={{
                      background: t.values.buttonStyle === "outline" ? "transparent" : t.values.buttonColor,
                      border: t.values.buttonStyle === "outline" ? `1.5px solid ${t.values.buttonColor}` : undefined,
                      borderRadius: t.values.buttonRadius === "full" ? "999px" : t.values.buttonRadius === "none" ? "0" : "5px",
                      opacity: 0.95,
                    }}
                  />
                ))}
              </div>
            </div>
            <p className="mt-1.5 text-center text-[11.5px] font-semibold text-ink-muted">{t.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const PRODUCTS = [
  { name: "Lightroom preset pack", price: 2400, sales: 1284, seed: "presets" },
  { name: "1:1 portfolio review", price: 12000, sales: 46, seed: "review" },
  { name: "Notion content OS", price: 3900, sales: 730, seed: "notion" },
];

function StoreVisual() {
  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-soft">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[12px] leading-4 text-ink-muted">Your store</p>
        <p className="text-[13px] font-semibold text-[#15803d]">+$4,120 this month</p>
      </div>
      <div className="mt-4 space-y-3">
        {PRODUCTS.map((p) => (
          <div key={p.name} className="flex items-center gap-3.5 rounded-2xl border border-line bg-canvas p-3 transition hover:border-line-strong">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={generatedAvatar(p.seed)} alt="" className="size-12 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-semibold text-ink">{p.name}</p>
              <p className="text-[13px] text-ink-muted">{p.sales.toLocaleString()} sold</p>
            </div>
            <span className="rounded-full bg-ink px-3 py-1 text-[13px] font-medium text-white">
              {formatMoney(p.price)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-line bg-canvas p-4 text-center">
        <p className="text-[13px] tracking-[-0.02em] text-ink-soft">0% platform fee on Pro</p>
      </div>
    </div>
  );
}

const BARS = [34, 52, 41, 68, 59, 82, 74, 96, 88, 100, 91, 76];
const DAYS = ["M", "T", "W", "T", "F", "S", "S", "M", "T", "W", "T", "F"];

function AnalyticsVisual() {
  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-soft">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Views", value: "128.4k", delta: "+18%" },
          { label: "Clicks", value: "41.2k", delta: "+24%" },
          { label: "CTR", value: "32.1%", delta: "+3.4pt" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-canvas p-3.5">
            <p className="text-[12px] font-semibold text-ink-muted">{s.label}</p>
            <p className="mt-1 text-[21px] leading-none font-semibold text-ink">{s.value}</p>
            <p className="mt-1.5 font-mono text-[12px] leading-4 text-brand-500">{s.delta}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex h-40 items-end gap-1.5">
        {BARS.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className="w-full rounded-t-md bg-ink transition-all duration-500"
              style={{ height: `${h}%` }}
            />
            <span className="text-[10px] font-semibold text-ink-muted">{DAYS[i]}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 space-y-2.5">
        {[
          { name: "New course — enrol now", pct: 42 },
          { name: "Portfolio", pct: 27 },
          { name: "Newsletter", pct: 19 },
        ].map((l) => (
          <div key={l.name}>
            <div className="flex justify-between text-[13px]">
              <span className="font-medium text-ink">{l.name}</span>
              <span className="font-medium text-ink-muted">{l.pct}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas">
              <div className="h-full rounded-full bg-ink" style={{ width: `${l.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MediaKitVisual() {
  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-soft">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={generatedAvatar("mayabuilds", "MO")} alt="" className="size-16 rounded-2xl" />
        <div>
          <p className="text-[18px] font-medium text-ink">Maya Osei</p>
          <p className="text-[14px] text-ink-muted">Design &amp; tech · Lisbon</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: "Followers", v: "284k" },
          { k: "Avg. reach", v: "96k" },
          { k: "Eng. rate", v: "7.4%" },
          { k: "Audience", v: "24–34" },
        ].map((s) => (
          <div key={s.k} className="rounded-xl bg-canvas p-3">
            <p className="text-[11.5px] font-semibold text-ink-muted">{s.k}</p>
            <p className="mt-0.5 text-[17px] font-semibold text-ink">{s.v}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 font-mono text-[12px] leading-4 text-ink-muted">Rate card</p>
      <div className="mt-2.5 divide-y divide-line rounded-2xl border border-line">
        {[
          ["Instagram Reel", 3200],
          ["TikTok video", 2800],
          ["Newsletter feature", 1500],
          ["Full campaign", 9000],
        ].map(([label, price]) => (
          <div key={label as string} className="flex items-center justify-between px-4 py-3">
            <span className="text-[14.5px] text-ink">{label}</span>
            <span className="text-[14.5px] font-medium text-ink">{formatMoney(Number(price) * 100)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Showcase() {
  return (
    <div className="flex flex-col gap-28 sm:gap-36">
      <Row
        eyebrow="Your page"
        title="A page that actually looks like you"
        body="Start from a theme, then change anything. Backgrounds, fonts, button shapes, corner radius, the lot. No two Plinks have to look the same."
        points={[
          "12 designer-made themes, endlessly tweakable",
          "Drag to reorder — the preview updates as you type",
          "Custom fonts, gradients, patterns and avatar shapes",
        ]}
        visual={<ThemeVisual />}
        cta={{ href: "/templates", label: "Browse templates" }}
      />
      <Row
        flip
        eyebrow="Monetise"
        title="Get paid without leaving your link"
        body="Sell digital products, take tips and book calls right from your page. No separate checkout, no redirect, no drop-off."
        points={[
          "Digital downloads, services and memberships",
          "Tip jar with preset amounts",
          "0% platform fee on Pro — you keep the revenue",
        ]}
        visual={<StoreVisual />}
        cta={{ href: "/pricing", label: "See pricing" }}
      />
      <Row
        eyebrow="Understand"
        title="Know what your audience actually clicks"
        body="Every view and click is tracked. See which links pull their weight, which ones don’t, and where your traffic really comes from."
        points={[
          "Views, clicks and click-through rate over time",
          "Top-performing links ranked automatically",
          "Referrer and device breakdowns",
        ]}
        visual={<AnalyticsVisual />}
        cta={{ href: "/signup", label: "Track your first click" }}
      />
      <Row
        flip
        eyebrow="Pitch"
        title="A media kit brands take seriously"
        body="Stop rebuilding a PDF every time a brand emails. Your media kit stays current, lives on a link, and reads like you know your numbers."
        points={[
          "Audience stats pulled from your own analytics",
          "Editable rate card with per-deliverable pricing",
          "Share as a link or export to PDF",
        ]}
        visual={<MediaKitVisual />}
        cta={{ href: "/signup", label: "Build a media kit" }}
      />
    </div>
  );
}
