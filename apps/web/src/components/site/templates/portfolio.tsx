import * as React from "react";
import type { SiteSection, SiteTheme } from "@plink/core/site-schema";
import { siteName, splitHero, type SiteRenderMode, type SiteTemplateProps } from "../site-model";
import { SiteNavLink } from "../nav-link";
import { FxBox, SiteBlockView } from "../blocks";

/**
 * Portfolio — a studio site.
 *
 * A sticky sidebar nav on desktop that collapses to a top row on mobile; a
 * huge left-aligned uppercase display hero with an offset subtitle; numbered
 * sections under heavy rules with an offset label column; products as minimal
 * rows. Extreme display sizes against tiny tracked-out labels.
 */
export function PortfolioTemplate({ document, page, nav, mode }: SiteTemplateProps) {
  const brand = siteName(document);
  const { hero, rest } = splitHero(page);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside
        className="border-b lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r"
        style={{ borderColor: "var(--pl-site-fg-14)" }}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 lg:h-full lg:flex-col lg:items-start lg:justify-start lg:gap-12 lg:px-8 lg:py-10">
          <p
            className="shrink-0 text-[14px] font-black uppercase tracking-[0.2em]"
            style={{ color: "var(--pl-site-fg)" }}
          >
            {brand}
          </p>
          <nav
            aria-label="Site"
            className="no-scrollbar flex items-center gap-4 overflow-x-auto lg:flex-col lg:items-start lg:gap-3"
          >
            {nav.map((item) => (
              <SiteNavLink
                key={item.id}
                item={item}
                mode={mode}
                className="shrink-0 text-[12px] font-bold uppercase tracking-[0.18em] transition-opacity hover:opacity-70"
                style={{ color: "var(--pl-site-muted)" }}
                currentStyle={{
                  color: "var(--pl-site-accent)",
                  textDecoration: "underline",
                  textUnderlineOffset: "5px",
                  textDecorationThickness: "2px",
                }}
              />
            ))}
          </nav>
        </div>
      </aside>

      <FxBox mode={mode} effects={page.effects}>
        <main className="px-5 pb-24 sm:px-10 lg:px-14">
          {hero ? (
            <Hero section={hero} theme={document.theme} mode={mode} />
          ) : (
            <h1
              className="max-w-[14ch] pt-14 text-[44px] font-black uppercase leading-[0.95] tracking-tight sm:pt-20 sm:text-[64px]"
              style={{ color: "var(--pl-site-fg)" }}
            >
              {page.title}
            </h1>
          )}

          {rest.map((section, index) => (
            <Section key={section.id} section={section} index={index} theme={document.theme} mode={mode} />
          ))}

          <footer
            className="mt-24 text-[11px] font-bold uppercase tracking-[0.25em]"
            style={{ color: "var(--pl-site-muted)" }}
          >
            {brand}
          </footer>
        </main>
      </FxBox>
    </div>
  );
}

function Hero({ section, theme, mode }: { section: SiteSection; theme: SiteTheme; mode: SiteRenderMode }) {
  const header = section.blocks.find((block) => block.type === "header") ?? null;
  const restBlocks = section.blocks.filter((block) => block !== header);

  return (
    <FxBox mode={mode} effects={section.effects} className="pb-6 pt-14 sm:pt-20">
      {header && (
        <FxBox mode={mode} effects={header.effects}>
          <h1
            className="max-w-[14ch] text-[44px] font-black uppercase leading-[0.95] tracking-tight sm:text-[72px] lg:text-[88px]"
            style={{ color: "var(--pl-site-fg)" }}
          >
            {header.title}
          </h1>
          {header.subtitle && (
            <p
              className="mt-6 max-w-[40ch] text-[16px] leading-relaxed sm:ml-[30%]"
              style={{ color: "var(--pl-site-muted)" }}
            >
              {header.subtitle}
            </p>
          )}
        </FxBox>
      )}
      {restBlocks.length > 0 && (
        <div className="mt-9 flex w-full max-w-sm flex-col gap-3 sm:ml-[30%]">
          {restBlocks.map((block) => (
            <SiteBlockView key={block.id} block={block} theme={theme} mode={mode} flavor="portfolio" />
          ))}
        </div>
      )}
    </FxBox>
  );
}

function Section({
  section,
  index,
  theme,
  mode,
}: {
  section: SiteSection;
  index: number;
  theme: SiteTheme;
  mode: SiteRenderMode;
}) {
  const number = String(index + 1).padStart(2, "0");
  return (
    <FxBox
      mode={mode}
      effects={section.effects}
      className="mt-16 border-t-2 pt-6"
      style={{ borderColor: "var(--pl-site-fg)" }}
    >
      <div className="gap-8 sm:grid sm:grid-cols-[140px_1fr]">
        <div className="mb-5 sm:mb-0">
          <p className="text-[13px] font-black tabular-nums" style={{ color: "var(--pl-site-accent)" }}>
            {number}
          </p>
          {section.title && (
            <h2
              className="mt-1 text-[12px] font-bold uppercase tracking-[0.22em]"
              style={{ color: "var(--pl-site-fg)" }}
            >
              {section.title}
            </h2>
          )}
        </div>
        <SectionBlocks section={section} theme={theme} mode={mode} />
      </div>
    </FxBox>
  );
}

function SectionBlocks({ section, theme, mode }: { section: SiteSection; theme: SiteTheme; mode: SiteRenderMode }) {
  const blocks = section.blocks.map((block) => (
    <SiteBlockView key={block.id} block={block} theme={theme} mode={mode} flavor="portfolio" />
  ));

  if (section.kind === "products") {
    return <div className="divide-y divide-[color:var(--pl-site-fg-14)]">{blocks}</div>;
  }
  if (section.kind === "links") {
    return <div className="flex w-full max-w-sm flex-col gap-3">{blocks}</div>;
  }
  return <div className="flex flex-col gap-7">{blocks}</div>;
}
