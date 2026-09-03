import * as React from "react";
import type { SiteSection, SiteTheme } from "@plink/core/site-schema";
import { siteName, splitHero, type SiteRenderMode, type SiteTemplateProps } from "../site-model";
import { SiteNavLink } from "../nav-link";
import { FxBox, SiteBlockView } from "../blocks";

/**
 * Storefront — a commerce site.
 *
 * Sticky top bar with the brand left and pill nav right (scrollable on small
 * screens); a boxed hero banner on the accent tint; sections as cards floating
 * on a subtly tinted surface; products as a responsive card grid with accent
 * price badges. Dense, boxy, and busy where editorial is airy.
 */
export function StorefrontTemplate({ document, page, nav, mode }: SiteTemplateProps) {
  const brand = siteName(document);
  const { hero, rest } = splitHero(page);

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: "var(--pl-site-bg)", borderColor: "var(--pl-site-fg-14)" }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <p className="shrink-0 text-[16px] font-extrabold tracking-tight" style={{ color: "var(--pl-site-fg)" }}>
            {brand}
          </p>
          <nav aria-label="Site" className="no-scrollbar flex items-center gap-1 overflow-x-auto">
            {nav.map((item) => (
              <SiteNavLink
                key={item.id}
                item={item}
                mode={mode}
                className="shrink-0 rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors"
                style={{ color: "var(--pl-site-muted)" }}
                currentStyle={{
                  color: "var(--pl-site-accent)",
                  background: "var(--pl-site-accent-10)",
                }}
              />
            ))}
          </nav>
        </div>
      </header>

      <FxBox mode={mode} effects={page.effects} className="flex-1" style={{ background: "var(--pl-site-fg-08)" }}>
        <main className="mx-auto w-full max-w-6xl px-5 pb-20">
          {hero ? (
            <Hero section={hero} theme={document.theme} mode={mode} />
          ) : (
            <div className="pt-10">
              <h1 className="text-[30px] font-extrabold tracking-tight sm:text-[38px]" style={{ color: "var(--pl-site-fg)" }}>
                {page.title}
              </h1>
            </div>
          )}

          {rest.map((section) => (
            <Section key={section.id} section={section} theme={document.theme} mode={mode} />
          ))}
        </main>
      </FxBox>

      <footer
        className="border-t py-8 text-center text-[12.5px] font-medium"
        style={{ borderColor: "var(--pl-site-fg-14)", color: "var(--pl-site-muted)", background: "var(--pl-site-bg)" }}
      >
        {brand}
      </footer>
    </div>
  );
}

function Hero({ section, theme, mode }: { section: SiteSection; theme: SiteTheme; mode: SiteRenderMode }) {
  const header = section.blocks.find((block) => block.type === "header") ?? null;
  const restBlocks = section.blocks.filter((block) => block !== header);

  return (
    <FxBox
      mode={mode}
      effects={section.effects}
      className="mt-6 border px-6 py-12 text-center sm:px-12 sm:py-16"
      style={{
        borderRadius: "min(var(--pl-radius), 24px)",
        background: "var(--pl-site-accent-10)",
        borderColor: "var(--pl-site-accent-10)",
      }}
    >
      {header && (
        <FxBox mode={mode} effects={header.effects}>
          <h1
            className="mx-auto max-w-[20ch] text-[32px] font-extrabold leading-[1.08] tracking-tight sm:text-[48px]"
            style={{ color: "var(--pl-site-fg)" }}
          >
            {header.title}
          </h1>
          {header.subtitle && (
            <p className="mx-auto mt-4 max-w-[52ch] text-[16px] leading-relaxed" style={{ color: "var(--pl-site-muted)" }}>
              {header.subtitle}
            </p>
          )}
        </FxBox>
      )}
      {restBlocks.length > 0 && (
        <div className="mx-auto mt-7 flex w-full max-w-md flex-col gap-3">
          {restBlocks.map((block) => (
            <SiteBlockView key={block.id} block={block} theme={theme} mode={mode} flavor="storefront" />
          ))}
        </div>
      )}
    </FxBox>
  );
}

function Section({ section, theme, mode }: { section: SiteSection; theme: SiteTheme; mode: SiteRenderMode }) {
  return (
    <FxBox
      mode={mode}
      effects={section.effects}
      className="mt-6 border p-5 sm:p-7"
      style={{
        borderRadius: "min(var(--pl-radius), 20px)",
        background: "var(--pl-site-bg)",
        borderColor: "var(--pl-site-fg-14)",
      }}
    >
      {section.title && (
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[18px] font-extrabold tracking-tight" style={{ color: "var(--pl-site-fg)" }}>
            {section.title}
          </h2>
          {section.kind === "products" && (
            <span className="text-[12.5px] font-semibold" style={{ color: "var(--pl-site-muted)" }}>
              {section.blocks.length} {section.blocks.length === 1 ? "item" : "items"}
            </span>
          )}
        </div>
      )}
      <SectionBlocks section={section} theme={theme} mode={mode} />
    </FxBox>
  );
}

function SectionBlocks({ section, theme, mode }: { section: SiteSection; theme: SiteTheme; mode: SiteRenderMode }) {
  const blocks = section.blocks.map((block) => (
    <SiteBlockView key={block.id} block={block} theme={theme} mode={mode} flavor="storefront" />
  ));

  if (section.kind === "products") {
    return <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{blocks}</div>;
  }
  if (section.kind === "links") {
    return <div className="mt-5 grid gap-3 sm:grid-cols-2">{blocks}</div>;
  }
  return <div className="mt-5 flex flex-col gap-5">{blocks}</div>;
}
