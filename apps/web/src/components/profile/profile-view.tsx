"use client";

import * as React from "react";
import Image from "next/image";
import { CircleCheck, MapPin, Coffee, ArrowUpRight, Plus, Minus } from "lucide-react";
import {
  avatarRadius, backgroundCss, buttonCss, fontStack, pageEffectVars, patternCss,
  radiusCss, rgba,
} from "@plink/core/themes";
import { parseConfig, toEmbedUrl } from "@plink/core/blocks";
import { socialPlatform } from "@plink/core/socials";
import { cn, formatMoney, initialsOf, safeUrl } from "@plink/core/utils";
import { EffectSurface, useSurfaceEffect } from "./effect-surface";
import { entranceMode, profileEffectClasses } from "./profile-effects";
import { EntranceGroup } from "@/components/effects";
import { generatedAvatar } from "@plink/core/avatar";
import { CalendarBlock } from "@/components/profile/calendar-block";
import type { PublicBlock, PublicProfile } from "@plink/core/profile-types";

type Props = {
  profile: PublicProfile;
  /** In preview mode links do not navigate and analytics are not recorded. */
  preview?: boolean;
  className?: string;
};

/**
 * Renders an anchor on a live page and a plain element in preview mode.
 * Previews are often nested inside a link (template cards, editor previews),
 * and an <a> inside an <a> is invalid HTML that breaks hydration.
 */
function Tappable({
  preview, href, className, style, onClick, children, ariaLabel, elementRef,
}: {
  preview: boolean;
  href: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
  elementRef?: React.Ref<HTMLAnchorElement & HTMLDivElement>;
}) {
  if (preview) {
    return (
      <div ref={elementRef} className={className} style={style} aria-label={ariaLabel}>
        {children}
      </div>
    );
  }
  return (
    <a
      ref={elementRef}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={style}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  );
}

export function ProfileView({ profile, preview = false, className }: Props) {
  const { theme } = profile;
  const blocks = profile.blocks.filter((b) => b.visible);

  // The creator's page-level effects. Every one of these is "" for a theme that
  // has not opted in, and `cn` drops empty strings — so a page without effects
  // renders exactly the markup it rendered before this feature existed.
  const fx = profileEffectClasses(theme);
  const entrance = entranceMode(theme.entranceEffect);
  // Custom properties inherit, so the palette set here reaches the background
  // effect on this element and the text effect on the headings below it.
  const paletteVars = fx.background || fx.text ? pageEffectVars(theme) : undefined;

  const track = React.useCallback(
    (blockId: string) => {
      if (preview) return;
      const body = JSON.stringify({ userId: profile.id, blockId });
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/track/click", new Blob([body], { type: "application/json" }));
      } else {
        void fetch("/api/track/click", { method: "POST", body, keepalive: true });
      }
    },
    [preview, profile.id],
  );

  return (
    <div
      // The background effect belongs on the element that already carries the
      // theme background: it paints on ::before, behind every child and deaf to
      // the pointer, so it can never swallow a click on a link.
      className={cn("relative min-h-full w-full", fx.background, className)}
      style={{
        ...backgroundCss(theme),
        ...paletteVars,
        color: theme.textColor,
        fontFamily: fontStack(theme.fontFamily),
      }}
    >
      {theme.bgPattern !== "none" && (
        // Positioned inline rather than with `absolute inset-0`: effects.css is
        // imported unlayered, so its `.pl-fx > *` rule outranks Tailwind's
        // layered `.absolute` the moment a background effect lands on the root.
        // An inline declaration outranks both. See docs/spikes/2026-09-03-
        // profile-effect-palette-and-attachment.md.
        <div
          className="pointer-events-none"
          style={{ position: "absolute", inset: 0, ...patternCss(theme) }}
          aria-hidden
        />
      )}

      <div className="relative mx-auto flex w-full max-w-[600px] flex-col px-5 pb-16 pt-10">
        {profile.bannerUrl && (
          <div
            className="mb-[-46px] h-32 w-full overflow-hidden bg-cover bg-center sm:h-40"
            style={{
              backgroundImage: `url(${profile.bannerUrl})`,
              borderRadius: theme.avatarShape === "square" ? "0px" : "20px",
            }}
            role="img"
            aria-label={`${profile.displayName} banner`}
          />
        )}

        <header className="flex flex-col items-center text-center">
          <Avatar profile={profile} />

          {/* Only the live page owns the document's h1 — previews are embedded
              inside other pages that already have one. */}
          {/* The text effect lands on the heading, not the inner span: it is
              block-level, which `wave` and `glitch` need to translate at all,
              and `background-clip: text` still clips to the name inside it. */}
          <NameHeading
            preview={preview}
            className={cn(
              "mt-4 flex items-center gap-1.5 text-[22px] font-bold tracking-tight",
              fx.text,
            )}
          >
            <span>{profile.displayName || `@${profile.username}`}</span>
            {profile.verified && (
              <CircleCheck className="size-[18px] shrink-0" style={{ color: theme.accentColor }} aria-label="Verified" />
            )}
          </NameHeading>

          <p className="mt-0.5 text-[14px] font-medium" style={{ color: theme.mutedColor }}>
            @{profile.username}
          </p>

          {(profile.category || profile.location) && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px]" style={{ color: theme.mutedColor }}>
              {profile.category && <span>{profile.category}</span>}
              {profile.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden />
                  {profile.location}
                </span>
              )}
            </div>
          )}

          {profile.bio && (
            <p className="mt-3 max-w-[42ch] text-[15px] leading-relaxed" style={{ color: theme.mutedColor }}>
              {profile.bio}
            </p>
          )}

          {profile.socials.length > 0 && !blocks.some((b) => b.type === "socials") && (
            <SocialRow socials={profile.socials} theme={theme} preview={preview} />
          )}
        </header>

        {/* `enter-stagger` animates its children, so it wraps the list; every
            other entrance effect animates itself, so it wraps each block and
            plays as that block scrolls into view. With no effect the group is
            inert and emits the same <div> as it always did. */}
        <EntranceGroup
          effect={entrance === "group" ? theme.entranceEffect : undefined}
          className="mt-7 flex flex-col gap-3.5"
        >
          {blocks.map((block) => {
            const rendered = (
              <BlockRenderer
                block={block}
                profile={profile}
                preview={preview}
                onTrack={track}
              />
            );
            return entrance === "item" ? (
              <EntranceGroup key={block.id} effect={theme.entranceEffect}>
                {rendered}
              </EntranceGroup>
            ) : (
              <React.Fragment key={block.id}>{rendered}</React.Fragment>
            );
          })}
          {blocks.length === 0 && (
            <div
              className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm"
              style={{ borderColor: rgba(theme.textColor, 0.25), color: theme.mutedColor }}
            >
              Nothing here yet.
            </div>
          )}
        </EntranceGroup>

        {!theme.hideBranding && (
          <footer className="mt-12 flex justify-center">
            <Tappable
              preview={preview}
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold backdrop-blur transition hover:opacity-80"
              style={{ background: rgba(theme.textColor, 0.1), color: theme.textColor }}
            >
              <span className="grid size-4 place-items-center rounded-[5px] text-[10px] font-black" style={{ background: theme.textColor, color: theme.bgColor }}>
                P
              </span>
              Make your own Plink
            </Tappable>
          </footer>
        )}
      </div>
    </div>
  );
}

function NameHeading({
  preview, className, children,
}: {
  preview: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  if (preview) return <p className={className}>{children}</p>;
  return <h1 className={className}>{children}</h1>;
}

function Avatar({ profile }: { profile: PublicProfile }) {
  const { theme } = profile;
  // Without an uploaded photo we generate deterministic art rather than showing
  // an empty circle — the same fallback the dashboard and directory use.
  const src =
    profile.avatarUrl ||
    generatedAvatar(profile.username, initialsOf(profile.displayName || profile.username));

  return (
    <div
      className="relative grid size-24 shrink-0 place-items-center overflow-hidden"
      style={{
        borderRadius: avatarRadius(theme.avatarShape),
        boxShadow: `0 0 0 3px ${rgba(theme.textColor, 0.18)}`,
      }}
    >
      <Image
        src={src}
        alt={profile.displayName || profile.username}
        fill
        sizes="96px"
        className="object-cover"
        unoptimized
      />
    </div>
  );
}

function SocialRow({
  socials, theme, preview, compact,
}: {
  socials: PublicProfile["socials"];
  theme: PublicProfile["theme"];
  preview: boolean;
  compact?: boolean;
}) {
  return (
    <nav className={cn("flex flex-wrap items-center justify-center gap-2", compact ? "mt-0" : "mt-4")} aria-label="Social links">
      {socials.map((s) => {
        const platform = socialPlatform(s.platform);
        if (!platform) return null;
        const Icon = platform.icon;
        return (
          <Tappable
            key={s.id}
            preview={preview}
            href={safeUrl(s.url)}
            ariaLabel={platform.name}
            className="grid size-10 place-items-center rounded-full transition-transform duration-150 hover:scale-110"
            style={{ background: rgba(theme.textColor, 0.12), color: theme.textColor }}
          >
            <Icon width={19} height={19} />
          </Tappable>
        );
      })}
    </nav>
  );
}

function BlockRenderer({
  block, profile, preview, onTrack,
}: {
  block: PublicBlock;
  profile: PublicProfile;
  preview: boolean;
  onTrack: (id: string) => void;
}) {
  const { theme } = profile;

  switch (block.type) {
    case "header": {
      // Section headings are the only other place a text effect belongs. The
      // explicit colour steps aside for it — the page already sets the same
      // one, and `text-gradient` needs to own `color` to paint through it.
      const textFx = profileEffectClasses(theme).text;
      return (
        <h2
          className={cn("mt-4 text-center text-[15px] font-bold tracking-wide uppercase", textFx)}
          style={{ color: textFx ? undefined : theme.textColor }}
        >
          {block.title}
        </h2>
      );
    }

    case "text":
      return (
        <div className="text-center text-[15px] leading-relaxed" style={{ color: theme.mutedColor }}>
          {block.title && (
            <p className="mb-1 font-semibold" style={{ color: theme.textColor }}>{block.title}</p>
          )}
          <p className="whitespace-pre-line">{block.subtitle}</p>
        </div>
      );

    case "divider":
      return <hr className="my-1 border-0 border-t" style={{ borderColor: rgba(theme.textColor, 0.18) }} />;

    case "socials":
      return <SocialRow socials={profile.socials} theme={theme} preview={preview} compact />;

    case "image": {
      const src = block.imageUrl || block.url;
      if (!src) return null;
      const inner = (
        <div className="relative w-full overflow-hidden" style={{ borderRadius: radiusCss(theme.buttonRadius) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={block.title || "Image"} className="w-full object-cover" loading="lazy" />
          {block.title && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8 text-left text-sm font-semibold text-white">
              {block.title}
            </div>
          )}
        </div>
      );
      if (!block.url || block.url === "#") return inner;
      return (
        <Tappable
          preview={preview}
          href={safeUrl(block.url)}
          onClick={() => onTrack(block.id)}
          className="block transition-transform duration-200 hover:scale-[1.01]"
        >
          {inner}
        </Tappable>
      );
    }

    case "video":
    case "music": {
      const embed = toEmbedUrl(block.url);
      if (!embed) {
        return <LinkButton block={block} theme={theme} preview={preview} onTrack={onTrack} />;
      }
      return (
        <div className="w-full">
          {block.title && (
            <p className="mb-2 text-center text-[14px] font-semibold" style={{ color: theme.textColor }}>{block.title}</p>
          )}
          <div
            className="w-full overflow-hidden"
            style={{ borderRadius: radiusCss(theme.buttonRadius), aspectRatio: embed.aspect === "auto" ? undefined : embed.aspect }}
          >
            <iframe
              src={embed.src}
              title={block.title || "Embedded media"}
              className="h-full w-full border-0"
              height={embed.aspect === "auto" ? 152 : undefined}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>
      );
    }

    case "email":
      return <EmailCapture block={block} profile={profile} preview={preview} />;

    case "tipjar":
      return <TipJar block={block} profile={profile} preview={preview} />;

    case "product": {
      const cfg = parseConfig<{ productId?: string }>(block.config);
      const product = profile.products.find((p) => p.id === cfg.productId) ?? profile.products[0];
      if (!product) return <LinkButton block={block} theme={theme} preview={preview} onTrack={onTrack} />;
      return <ProductCard product={product} theme={theme} preview={preview} />;
    }

    case "gallery": {
      const cfg = parseConfig<{ items?: { imageUrl: string; url?: string; caption?: string }[] }>(block.config);
      const items = cfg.items ?? [];
      if (items.length === 0) return null;
      return (
        <div className="w-full">
          {block.title && (
            <p className="mb-2 text-[14px] font-semibold" style={{ color: theme.textColor }}>{block.title}</p>
          )}
          <div className="no-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
            {items.map((item, i) => (
              <Tappable
                key={i}
                preview={preview || !item.url}
                href={safeUrl(item.url ?? "")}
                onClick={() => onTrack(block.id)}
                className="w-36 shrink-0 snap-start"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt={item.caption ?? ""}
                  className="h-36 w-36 object-cover"
                  style={{ borderRadius: radiusCss(theme.buttonRadius) }}
                  loading="lazy"
                />
                {item.caption && (
                  <p className="mt-1.5 truncate text-[12px]" style={{ color: theme.mutedColor }}>{item.caption}</p>
                )}
              </Tappable>
            ))}
          </div>
        </div>
      );
    }

    case "faq":
      return <Faq block={block} theme={theme} preview={preview} />;

    case "calendar":
      return <CalendarBlock block={block} profile={profile} preview={preview} onTrack={onTrack} />;

    default:
      return <LinkButton block={block} theme={theme} preview={preview} onTrack={onTrack} />;
  }
}

function LinkButton({
  block, theme, preview, onTrack,
}: {
  block: PublicBlock;
  theme: PublicProfile["theme"];
  preview: boolean;
  onTrack: (id: string) => void;
}) {
  const style = buttonCss(theme);
  const {
    ref: effectRef,
    className: effectClassName,
    style: effectStyle,
  } = useSurfaceEffect<HTMLAnchorElement & HTMLDivElement>(theme, preview);
  return (
    <Tappable
      preview={preview}
      elementRef={effectRef}
      href={safeUrl(block.url)}
      onClick={() => onTrack(block.id)}
      className={cn(
        effectClassName,
        "group relative flex w-full items-center gap-3 px-4 py-4 text-center font-semibold transition-all duration-200",
        preview ? "cursor-default" : "hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0",
        block.highlight && "animate-[pop_0.4s_ease-out]",
      )}
      style={{
        ...style,
        ...effectStyle,
        ...(block.highlight ? { boxShadow: `0 0 0 2px ${theme.accentColor}, ${String(style.boxShadow ?? "")}`.replace(/,\s*$/, "") } : null),
      }}
    >
      {block.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={block.imageUrl} alt="" className="size-9 shrink-0 rounded-lg object-cover" loading="lazy" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] leading-tight">{block.title || "Untitled link"}</span>
        {block.subtitle && <span className="mt-0.5 block truncate text-[12.5px] font-medium opacity-70">{block.subtitle}</span>}
      </span>
      <ArrowUpRight className="size-4 shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-60" aria-hidden />
    </Tappable>
  );
}

function EmailCapture({
  block, profile, preview,
}: {
  block: PublicBlock;
  profile: PublicProfile;
  preview: boolean;
}) {
  const { theme } = profile;
  const cfg = parseConfig<{ buttonLabel?: string; placeholder?: string }>(block.config);
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<"idle" | "loading" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (preview) return;
    setState("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id, email }),
      });
      setState(res.ok ? "done" : "error");
      if (res.ok) setEmail("");
    } catch {
      setState("error");
    }
  }

  return (
    <EffectSurface theme={theme} preview={preview} className="w-full p-4" style={{ ...buttonCss(theme), textAlign: "left" }}>
      <p className="text-[15px] font-bold">{block.title}</p>
      {block.subtitle && <p className="mt-0.5 text-[13px] opacity-75">{block.subtitle}</p>}
      {state === "done" ? (
        <p className="mt-3 text-[14px] font-semibold" style={{ color: theme.accentColor }}>
          You’re on the list. Thank you!
        </p>
      ) : (
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={cfg.placeholder ?? "you@email.com"}
            aria-label="Email address"
            className="min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-[14px] outline-none"
            style={{
              borderColor: rgba(theme.textColor, 0.25),
              background: rgba(theme.textColor, 0.07),
              color: theme.textColor,
            }}
          />
          <button
            type="submit"
            disabled={state === "loading"}
            className="shrink-0 rounded-xl px-4 py-2.5 text-[14px] font-bold transition disabled:opacity-60"
            style={{ background: theme.accentColor, color: theme.bgColor }}
          >
            {state === "loading" ? "…" : (cfg.buttonLabel ?? "Subscribe")}
          </button>
        </form>
      )}
      {state === "error" && (
        <p className="mt-2 text-[13px] font-medium" style={{ color: theme.accentColor }}>
          Something went wrong. Try again.
        </p>
      )}
    </EffectSurface>
  );
}

function ProductCard({
  product, theme, preview,
}: {
  product: PublicProfile["products"][number];
  theme: PublicProfile["theme"];
  preview: boolean;
}) {
  const [state, setState] = React.useState<"idle" | "loading">("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function buy() {
    if (preview || state === "loading") return;
    setState("loading");
    setError(null);
    try {
      const res = await fetch("/api/checkout/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      // Hand off to Stripe Checkout; the webhook marks the order paid on return.
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      setError(data.error ?? "Couldn’t start checkout. Try again.");
      setState("idle");
    } catch {
      setError("Couldn’t start checkout. Try again.");
      setState("idle");
    }
  }

  return (
    <EffectSurface theme={theme} preview={preview} className="w-full" style={{ ...buttonCss(theme), textAlign: "left" }}>
      <button
        type="button"
        onClick={buy}
        disabled={preview || state === "loading"}
        aria-label={`Buy ${product.name}`}
        className={cn(
          "flex w-full items-center gap-3 p-3 text-left transition-opacity",
          preview ? "cursor-default" : "hover:opacity-90",
          state === "loading" && "opacity-60",
        )}
      >
        <div className="size-14 shrink-0 overflow-hidden rounded-xl" style={{ background: rgba(theme.textColor, 0.12) }}>
          {product.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[14.5px] leading-tight font-bold">{product.name}</p>
          {product.description && (
            <p className="mt-1 line-clamp-1 text-[12.5px] opacity-75">{product.description}</p>
          )}
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-bold"
          style={{ background: rgba(theme.accentColor, 0.9), color: theme.bgColor }}
        >
          {state === "loading"
            ? "…"
            : product.priceCents === 0
              ? "Free"
              : formatMoney(product.priceCents, product.currency)}
        </span>
      </button>
      {error && (
        <p className="px-3 pb-3 text-[13px] opacity-80" role="alert">
          {error}
        </p>
      )}
    </EffectSurface>
  );
}

function TipJar({
  block, profile, preview,
}: {
  block: PublicBlock;
  profile: PublicProfile;
  preview: boolean;
}) {
  const { theme } = profile;
  const cfg = parseConfig<{ amounts?: number[]; currency?: string }>(block.config);
  const amounts = cfg.amounts?.length ? cfg.amounts : [3, 5, 10];
  const [selected, setSelected] = React.useState(amounts[1] ?? amounts[0]);
  const [state, setState] = React.useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function tip() {
    if (preview) return;
    setState("loading");
    setError(null);
    try {
      const res = await fetch("/api/checkout/tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id, amountCents: selected * 100 }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      // Hand off to Stripe Checkout; the webhook records the order on return.
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      setError(data.error ?? "Couldn’t start checkout. Try again.");
      setState("idle");
    } catch {
      setError("Couldn’t start checkout. Try again.");
      setState("idle");
    }
  }

  return (
    <EffectSurface theme={theme} preview={preview} className="w-full p-4" style={{ ...buttonCss(theme), textAlign: "left" }}>
      <p className="flex items-center gap-2 text-[15px] font-bold">
        <Coffee className="size-4" aria-hidden />
        {block.title}
      </p>
      {block.subtitle && <p className="mt-0.5 text-[13px] opacity-75">{block.subtitle}</p>}
      {state === "done" ? (
        <p className="mt-3 text-[14px] font-semibold" style={{ color: theme.accentColor }}>
          Thank you for the support! 🧡
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {amounts.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setSelected(a)}
                aria-pressed={selected === a}
                className="rounded-xl border px-3.5 py-2 text-[14px] font-bold transition"
                style={
                  selected === a
                    ? { borderColor: theme.accentColor, background: theme.accentColor, color: theme.bgColor }
                    : { borderColor: rgba(theme.textColor, 0.25), color: theme.textColor }
                }
              >
                {formatMoney(a * 100, cfg.currency ?? "USD")}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={tip}
            disabled={state === "loading"}
            className="mt-3 w-full rounded-xl py-2.5 text-[14px] font-bold transition disabled:opacity-60"
            style={{ background: theme.accentColor, color: theme.bgColor }}
          >
            {state === "loading" ? "Processing…" : `Send ${formatMoney(selected * 100, cfg.currency ?? "USD")}`}
          </button>
          {error && (
            <p className="mt-2 text-[13px] opacity-80" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </EffectSurface>
  );
}

function Faq({ block, theme, preview }: { block: PublicBlock; theme: PublicProfile["theme"]; preview: boolean }) {
  const cfg = parseConfig<{ items?: { q: string; a: string }[] }>(block.config);
  const items = cfg.items ?? [];
  const [open, setOpen] = React.useState<number | null>(0);
  if (items.length === 0) return null;

  return (
    <EffectSurface theme={theme} preview={preview} className="w-full overflow-hidden" style={{ ...buttonCss(theme), textAlign: "left" }}>
      {block.title && <p className="px-4 pt-4 text-[15px] font-bold">{block.title}</p>}
      <div className="divide-y" style={{ borderColor: rgba(theme.textColor, 0.14) }}>
        {items.map((item, i) => (
          <div key={i} className="px-4">
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
              className="flex w-full items-center justify-between gap-3 py-3.5 text-left text-[14px] font-semibold"
            >
              {item.q}
              {open === i ? <Minus className="size-4 shrink-0" /> : <Plus className="size-4 shrink-0" />}
            </button>
            {open === i && (
              <p className="pb-4 text-[13.5px] leading-relaxed opacity-75">{item.a}</p>
            )}
          </div>
        ))}
      </div>
    </EffectSurface>
  );
}
