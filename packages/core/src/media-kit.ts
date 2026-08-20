export type RateCardItem = { deliverable: string; priceCents: number; note?: string };

export type AudienceStats = {
  followers?: string;
  reach?: string;
  engagement?: string;
  ageRange?: string;
  topCountries?: string;
  splitFemale?: string;
};

export type MediaKitShape = {
  headline: string;
  about: string;
  rateCard: RateCardItem[];
  audience: AudienceStats;
  brands: string[];
  published: boolean;
};

export function parseMediaKit(row: {
  headline: string; about: string; rateCard: string; audience: string; brands: string; published: boolean;
} | null): MediaKitShape {
  const safeParse = <T,>(raw: string, fallback: T): T => {
    try {
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  };

  return {
    headline: row?.headline ?? "",
    about: row?.about ?? "",
    rateCard: row ? safeParse<RateCardItem[]>(row.rateCard, []) : [],
    audience: row ? safeParse<AudienceStats>(row.audience, {}) : {},
    brands: row ? safeParse<string[]>(row.brands, []) : [],
    published: row?.published ?? false,
  };
}

export const DEFAULT_DELIVERABLES = [
  "Instagram Reel",
  "Instagram Story set",
  "TikTok video",
  "YouTube integration",
  "Newsletter feature",
  "Full campaign",
];
