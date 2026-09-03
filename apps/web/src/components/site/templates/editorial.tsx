import * as React from "react";
import type { SiteSection, SiteTheme } from "@plink/core/site-schema";
import { siteName, splitHero, type SiteRenderMode, type SiteTemplateProps } from "../site-model";
import { SiteNavLink } from "../nav-link";
import { FxBox, SiteBlockView } from "../blocks";

/**
 * Editorial — a literary magazine.
 *
 * Masthead over a centered, hairline-ruled nav; an oversized serif display
 * hero; one ~65ch prose column with small-caps kickers and wide vertical air;
 * products as ruled list rows with the price right-aligned. The quietest of
 * the three templates: type does all the work.
 */
export function EditorialTemplate({ document, page, nav, mode }: SiteTemplateProps) {
  const brand = siteName(document);
  const { hero, rest } = splitHero(page);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 sm:px-8">
      <header className="pt-10 text-center sm:pt-14">
        <p
          className="font-serif text-[15px] font-semibold uppercase tracking-[0.35em]"
          style={{ color: "var(--pl-site-fg)" }}
        >
          {brand}
        </p>
        <nav
          aria-label="Site"
          className="mt-6 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 border-y py-3"
          style={{ borderColor: "var(--pl-site-fg-14)" }}
        >
          {nav.map((item) => (
            <SiteNavLink
              key={item.id}
              item={item}
              mode={mode}
              className="text-[12px] font-bold uppercase tracking-[0.22em] transition-opacity hover:opacity-70"
              style={{ color: "var(--pl-site-muted)" }}
              currentStyle={{
                color: "var(--pl-site-accent)",
                textDecoration: "underline",
                textUnderlineOffset: "6px",
              }}
            />
          ))}
        </nav>
      </header>

      <FxBox mode={mode} effects={page.effects} className="flex-1">
        <main>
          {hero ? (
            <Hero section={hero} theme={document.theme} mode={mode} />
          ) : (
            <div className="py-14 text-center sm:py-20">
              <h1
                className="font-serif text-[40px] leading-[1.05] tracking-tight sm:text-[56px]"
                style={{ color: "var(--pl-site-fg)" }}
              >
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
        className="mt-auto border-t py-10 text-center text-[12px] uppercase tracking-[0.25em]"
        style={{ borderColor: "var(--pl-site-fg-14)", color: "var(--pl-site-muted)" }}
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
    <FxBox mode={mode} effects={section.effects} className="py-16 text-center sm:py-24">
      {header && (
        <FxBox mode={mode} effects={header.effects}>
          <h1
            className="mx-auto max-w-[18ch] font-serif text-[42px] leading-[1.04] tracking-tight sm:text-[64px]"
            style={{ color: "var(--pl-site-fg)" }}
          >
            {header.title}
          </h1>
          {header.subtitle && (
            <p
              className="mx-auto mt-5 max-w-[46ch] text-[17px] leading-relaxed"
              style={{ color: "var(--pl-site-muted)" }}
            >
              {header.subtitle}
            </p>
          )}
        </FxBox>
      )}
      {restBlocks.length > 0 && (
        <div className="mx-auto mt-9 flex w-full max-w-md flex-col gap-3.5">
          {restBlocks.map((block) => (
            <SiteBlockView key={block.id} block={block} theme={theme} mode={mode} flavor="editorial" />
          ))}
        </div>
      )}
    </FxBox>
  );
}

function Section({ section, theme, mode }: { section: SiteSection; theme: SiteTheme; mode: SiteRenderMode }) {
  return (
    <FxBox mode={mode} effects={section.effects} className="py-12 sm:py-16">
      {section.title && (
        <p
          className="text-center text-[12px] font-bold uppercase tracking-[0.3em]"
          style={{ color: "var(--pl-site-accent)" }}
        >
          {section.title}
        </p>
      )}
      <SectionBlocks section={section} theme={theme} mode={mode} />
    </FxBox>
  );
}

function SectionBlocks({ section, theme, mode }: { section: SiteSection; theme: SiteTheme; mode: SiteRenderMode }) {
  const blocks = section.blocks.map((block) => (
    <SiteBlockView key={block.id} block={block} theme={theme} mode={mode} flavor="editorial" />
  ));

  if (section.kind === "products") {
    return (
      <div className="mx-auto mt-6 max-w-[65ch] divide-y divide-[color:var(--pl-site-fg-14)]">
        {blocks}
      </div>
    );
  }
  if (section.kind === "links") {
    return <div className="mx-auto mt-7 flex w-full max-w-md flex-col gap-3.5">{blocks}</div>;
  }
  return <div className="mx-auto mt-7 flex max-w-[65ch] flex-col gap-8">{blocks}</div>;
}
