/**
 * AI Website Generator — brief → SiteDocument proposal.
 *
 * OWNER: feat/website-generator (Wave 2). This stub fixes the public surface
 * so the studio and routes can compile against it before the feature lands.
 * Same rules as `index.ts`: nothing talks to a provider at import time, and
 * everything a model returns passes through a sanitiser before it is trusted.
 */

import type { BriefData, SiteDocument } from "@plink/core/site-schema";

export type GenerateSiteInput = {
  brief: BriefData;
  /** Template the operator picked; the generator may not override it. */
  template: SiteDocument["template"];
};

/**
 * Generates a complete site configuration from a structured brief.
 * Implemented by feat/website-generator; until then callers must gate on
 * `aiEnabled()` and treat this as unavailable.
 */
export async function generateSiteDocument(_input: GenerateSiteInput): Promise<SiteDocument> {
  throw new Error("Site generation is not implemented yet (feat/website-generator).");
}

/**
 * The safety boundary for model-produced site documents. Drops unknown pages,
 * sections, block types and effect ids; strips non-http(s) URLs; clamps every
 * limit — then re-validates through `siteDocumentSchema`. Pure, never throws.
 * Implemented by feat/website-generator.
 */
export function sanitizeSiteDocument(_raw: unknown, template: SiteDocument["template"]): SiteDocument | null {
  void template;
  return null;
}
