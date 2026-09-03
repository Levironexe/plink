import * as React from "react";
import type { SiteDocument, SiteTemplateId } from "@plink/core/site-schema";
import { cn } from "@plink/core/utils";
import {
  buildSiteNav,
  normalizeTemplateId,
  resolveSitePage,
  siteThemeVars,
  type SiteRenderMode,
  type SiteTemplateProps,
} from "./site-model";
import { FxBox } from "./blocks";
import { EditorialTemplate } from "./templates/editorial";
import { StorefrontTemplate } from "./templates/storefront";
import { PortfolioTemplate } from "./templates/portfolio";

/**
 * One SiteDocument in, one website out — which website is entirely the
 * document's business. The registry is keyed by `normalizeTemplateId`, so a
 * document naming a template we do not ship renders as editorial instead of
 * crashing (the same never-break-a-page rule the schema and effects follow).
 */
const TEMPLATES: Record<SiteTemplateId, (props: SiteTemplateProps) => React.ReactNode> = {
  editorial: EditorialTemplate,
  storefront: StorefrontTemplate,
  portfolio: PortfolioTemplate,
};

export type SiteRendererProps = {
  document: SiteDocument;
  /** Preview renders identically but records no analytics and navigates nowhere. */
  mode: SiteRenderMode;
  /**
   * Where the site is mounted (`/s/<slug>`), prefixed onto nav hrefs. Live
   * routes always pass it; previews may omit it because preview nav is inert.
   */
  basePath?: string;
  /** The page being rendered (`/`, `/shop`, …). Unknown paths — which the
   * routes have already 404ed — fall back to the root page. */
  path?: string;
};

/**
 * Server-renderable. The root sets the whole theme contract in one place —
 * `--pl-*` palette vars for any effect surface in the tree plus the
 * `--pl-site-*` tokens template CSS consumes — then hands off to the template.
 * Site-level effects ride on this root; page effects ride on the template's
 * page container; sections and blocks carry their own.
 */
export function SiteRenderer({ document, mode, basePath = "", path = "/" }: SiteRendererProps) {
  const Template = TEMPLATES[normalizeTemplateId(document.template)];
  const segments = path.split("/").filter(Boolean);
  const page = resolveSitePage(document, segments) ?? document.pages[0];
  const nav = buildSiteNav(document, basePath, page.path);

  return (
    <FxBox
      mode={mode}
      effects={document.effects}
      className={cn("min-h-dvh w-full overflow-x-clip")}
      style={{
        ...siteThemeVars(document.theme),
        background: "var(--pl-site-bg)",
        color: "var(--pl-site-fg)",
        fontFamily: "var(--pl-font)",
      }}
    >
      <Template document={document} page={page} nav={nav} mode={mode} />
    </FxBox>
  );
}
