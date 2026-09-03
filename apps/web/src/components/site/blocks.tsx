import * as React from "react";
import { blockDefinition, toEmbedUrl } from "@plink/core/blocks";
import { socialPlatform } from "@plink/core/socials";
import { cn, safeUrl } from "@plink/core/utils";
import { effectNeedsPointer } from "@plink/effects/registry";
import type { EffectAssignment, SiteBlock, SiteTemplateId, SiteTheme } from "@plink/core/site-schema";
import { fx, siteButtonCss, type SiteRenderMode } from "./site-model";
import { PointerSurface } from "./pointer-surface";

/**
 * Shared block visuals for all three templates.
 *
 * A template owns its section chrome (nav placement, hero, rhythm); the blocks
 * inside share one implementation here, parameterized by `flavor`, so products
 * can be grid cards in storefront but list rows in editorial without three
 * copies of the safe-URL / embed / effect plumbing. `flavor` is the template id
 * — there is exactly one flavor per template, never a fourth vocabulary.
 */
export type BlockFlavor = SiteTemplateId;

/* ------------------------------------------------------- effect plumbing */

function pointerNeeded(mode: SiteRenderMode, effects: EffectAssignment | undefined): boolean {
  // Previews are decorative and often rendered many times over; like the
  // profile renderer they never attach pointer tracking.
  return mode === "live" && effectNeedsPointer(effects?.surface);
}

/**
 * A static container carrying a block/section effect. Resolves to a plain div
 * when nothing (or nothing known) is assigned — resting markup gains no
 * scaffolding — and to the client PointerSurface only when the assigned
 * surface effect actually reads the cursor.
 */
export function FxBox({
  mode,
  effects,
  className,
  style,
  children,
}: {
  mode: SiteRenderMode;
  effects?: EffectAssignment;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const effectCls = fx(effects);
  const cls = cn(className, effectCls);
  if (effectCls && pointerNeeded(mode, effects)) {
    return (
      <PointerSurface className={cls} style={style}>
        {children}
      </PointerSurface>
    );
  }
  return (
    <div className={cls} style={style}>
      {children}
    </div>
  );
}

/**
 * A tappable block surface: a real anchor on live pages, an inert div in
 * previews (previews are embedded inside pages that already link — an <a>
 * inside an <a> is invalid HTML, the profile renderer's Tappable rule).
 */
function Tap({
  mode,
  effects,
  href,
  ariaLabel,
  className,
  style,
  children,
}: {
  mode: SiteRenderMode;
  effects?: EffectAssignment;
  href: string;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const effectCls = fx(effects);
  const cls = cn(className, effectCls);
  if (mode === "preview") {
    return (
      <div className={cls} style={style} aria-label={ariaLabel}>
        {children}
      </div>
    );
  }
  if (effectCls && pointerNeeded(mode, effects)) {
    return (
      <PointerSurface as="a" href={safeUrl(href)} ariaLabel={ariaLabel} className={cls} style={style}>
        {children}
      </PointerSurface>
    );
  }
  return (
    <a
      href={safeUrl(href)}
      target="_blank"
      rel="noopener noreferrer"
      className={cls}
      style={style}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  );
}

/* ------------------------------------------------------------- dispatch */

type BlockProps = {
  block: SiteBlock;
  theme: SiteTheme;
  mode: SiteRenderMode;
  flavor: BlockFlavor;
};

/**
 * One block, rendered. Full visuals for header, text, link, product, image,
 * video/music, socials and divider; every other type the block library knows
 * falls back to a link button (when it has a URL) or a text presentation, and
 * a type nobody knows renders nothing — a stale document never breaks a page.
 */
export function SiteBlockView(props: BlockProps) {
  const { block } = props;
  switch (block.type) {
    case "header":
      return <HeaderBlock {...props} />;
    case "text":
      return <TextBlock {...props} />;
    case "link":
      return <LinkBlock {...props} />;
    case "product":
      return <ProductBlock {...props} />;
    case "image":
      return <ImageBlock {...props} />;
    case "video":
    case "music":
      return <EmbedBlock {...props} />;
    case "socials":
      return <SocialsBlock {...props} />;
    case "divider":
      return <DividerBlock {...props} />;
    default: {
      if (!blockDefinition(block.type)) return null;
      return block.url ? <LinkBlock {...props} /> : <TextBlock {...props} />;
    }
  }
}

/* ---------------------------------------------------------------- blocks */

const HEADER_STYLE: Record<BlockFlavor, string> = {
  editorial: "text-center font-serif text-2xl tracking-tight",
  storefront: "text-lg font-bold tracking-tight",
  portfolio: "text-sm font-bold uppercase tracking-[0.22em]",
};

function HeaderBlock({ block, mode, flavor }: BlockProps) {
  return (
    <FxBox mode={mode} effects={block.effects} className={flavor === "editorial" ? "text-center" : ""}>
      <h3 className={HEADER_STYLE[flavor]} style={{ color: "var(--pl-site-fg)" }}>
        {block.title}
      </h3>
      {block.subtitle && (
        <p className="mt-1 text-[14px]" style={{ color: "var(--pl-site-muted)" }}>
          {block.subtitle}
        </p>
      )}
    </FxBox>
  );
}

function TextBlock({ block, mode, flavor }: BlockProps) {
  return (
    <FxBox
      mode={mode}
      effects={block.effects}
      className={flavor === "editorial" ? "text-[16px] leading-[1.75]" : "text-[15px] leading-relaxed"}
    >
      {block.title && (
        <p className="mb-1 font-semibold" style={{ color: "var(--pl-site-fg)" }}>
          {block.title}
        </p>
      )}
      {block.subtitle && (
        <p className="whitespace-pre-line" style={{ color: "var(--pl-site-muted)" }}>
          {block.subtitle}
        </p>
      )}
    </FxBox>
  );
}

function LinkBlock({ block, theme, mode }: BlockProps) {
  return (
    <Tap
      mode={mode}
      effects={block.effects}
      href={block.url}
      className={cn(
        "relative flex w-full flex-col items-center justify-center px-5 py-3.5 text-center font-semibold transition-all duration-200",
        mode === "live" && "hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0",
      )}
      style={siteButtonCss(theme)}
    >
      <span className="text-[15px] leading-tight">{block.title || "Untitled link"}</span>
      {block.subtitle && (
        <span className="mt-0.5 text-[12.5px] font-medium opacity-70">{block.subtitle}</span>
      )}
    </Tap>
  );
}

/**
 * Products carry the name in `title` and the display price in `subtitle`
 * (the generator writes them that way). The three flavors are the clearest
 * visible proof of "same document, different site": a ruled list row, a shop
 * card, a minimal numbered-adjacent media row.
 */
function ProductBlock({ block, mode, flavor }: BlockProps) {
  if (flavor === "storefront") {
    return (
      <Tap
        mode={mode}
        effects={block.effects}
        href={block.url}
        ariaLabel={block.title}
        className={cn(
          "relative flex h-full flex-col gap-3 border p-4 transition-all duration-200",
          mode === "live" && "hover:-translate-y-0.5 hover:shadow-lg",
        )}
        style={{
          borderRadius: "min(var(--pl-radius), 16px)",
          borderColor: "var(--pl-site-fg-14)",
          background: "var(--pl-site-bg)",
        }}
      >
        {block.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={block.imageUrl}
            alt=""
            className="aspect-[4/3] w-full object-cover"
            style={{ borderRadius: "min(var(--pl-radius), 10px)" }}
            loading="lazy"
          />
        )}
        <span className="text-[15px] font-bold leading-snug" style={{ color: "var(--pl-site-fg)" }}>
          {block.title}
        </span>
        {block.subtitle && (
          <span
            className="mt-auto self-start px-2.5 py-1 text-[12.5px] font-bold"
            style={{
              borderRadius: "999px",
              background: "var(--pl-site-accent)",
              color: "var(--pl-site-bg)",
            }}
          >
            {block.subtitle}
          </span>
        )}
      </Tap>
    );
  }

  if (flavor === "portfolio") {
    return (
      <Tap
        mode={mode}
        effects={block.effects}
        href={block.url}
        ariaLabel={block.title}
        className={cn("group relative flex items-baseline gap-4 py-3", mode === "live" && "hover:opacity-80")}
      >
        <span className="text-[15px] font-medium" style={{ color: "var(--pl-site-fg)" }}>
          {block.title}
        </span>
        <span
          className="ml-auto shrink-0 text-[12px] font-bold uppercase tracking-[0.14em]"
          style={{ color: "var(--pl-site-muted)" }}
        >
          {block.subtitle}
        </span>
      </Tap>
    );
  }

  // editorial — a ruled list row, price right-aligned in the accent.
  return (
    <Tap
      mode={mode}
      effects={block.effects}
      href={block.url}
      ariaLabel={block.title}
      className={cn("relative flex items-baseline justify-between gap-6 py-3.5", mode === "live" && "hover:opacity-80")}
    >
      <span className="text-[16px]" style={{ color: "var(--pl-site-fg)" }}>
        {block.title}
      </span>
      <span className="shrink-0 text-[15px] font-semibold" style={{ color: "var(--pl-site-accent)" }}>
        {block.subtitle}
      </span>
    </Tap>
  );
}

function ImageBlock({ block, mode }: BlockProps) {
  const src = block.imageUrl || block.url;
  if (!src) return null;
  const image = (
    <figure
      className="relative w-full overflow-hidden"
      style={{ borderRadius: "min(var(--pl-radius), 14px)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={safeUrl(src)} alt={block.title || "Image"} className="w-full object-cover" loading="lazy" />
      {block.title && (
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8 text-left text-sm font-semibold text-white">
          {block.title}
        </figcaption>
      )}
    </figure>
  );
  if (!block.url || block.url === "#" || block.url === src) {
    return (
      <FxBox mode={mode} effects={block.effects}>
        {image}
      </FxBox>
    );
  }
  return (
    <Tap mode={mode} effects={block.effects} href={block.url} className="block">
      {image}
    </Tap>
  );
}

function EmbedBlock(props: BlockProps) {
  const { block, mode } = props;
  const embed = toEmbedUrl(block.url);
  if (!embed) return <LinkBlock {...props} />;
  return (
    <FxBox mode={mode} effects={block.effects} className="w-full">
      {block.title && (
        <p className="mb-2 text-[14px] font-semibold" style={{ color: "var(--pl-site-fg)" }}>
          {block.title}
        </p>
      )}
      <div
        className="w-full overflow-hidden"
        style={{
          borderRadius: "min(var(--pl-radius), 14px)",
          aspectRatio: embed.aspect === "auto" ? undefined : embed.aspect,
        }}
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
    </FxBox>
  );
}

/** Socials live in the block's config: `{ items: [{ platform, url }] }`. */
function SocialsBlock({ block, mode }: BlockProps) {
  const raw = block.config.items;
  const items = Array.isArray(raw)
    ? raw.filter(
        (item): item is { platform: string; url: string } =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as { platform?: unknown }).platform === "string" &&
          typeof (item as { url?: unknown }).url === "string",
      )
    : [];
  if (items.length === 0) return null;
  return (
    <FxBox mode={mode} effects={block.effects} className="flex flex-wrap items-center gap-2">
      {items.map((item, i) => {
        const platform = socialPlatform(item.platform);
        if (!platform) return null;
        const Icon = platform.icon;
        return (
          <Tap
            key={i}
            mode={mode}
            href={item.url}
            ariaLabel={platform.name}
            className="grid size-10 place-items-center rounded-full transition-transform duration-150 hover:scale-110"
            style={{ background: "var(--pl-site-fg-08)", color: "var(--pl-site-fg)" }}
          >
            <Icon width={18} height={18} />
          </Tap>
        );
      })}
    </FxBox>
  );
}

function DividerBlock({ block, mode }: BlockProps) {
  return (
    <FxBox mode={mode} effects={block.effects}>
      <hr className="border-0 border-t" style={{ borderColor: "var(--pl-site-fg-14)" }} />
    </FxBox>
  );
}
