import { describe, expect, it } from "vitest";
import { parseMediaKit } from "@/lib/media-kit";
import { deviceFrom, referrerFrom } from "@/lib/http";

describe("parseMediaKit", () => {
  it("returns empty defaults when there is no row", () => {
    const kit = parseMediaKit(null);
    expect(kit).toEqual({ headline: "", about: "", rateCard: [], audience: {}, brands: [], published: false });
  });

  it("parses stored JSON columns", () => {
    const kit = parseMediaKit({
      headline: "Hi",
      about: "About",
      rateCard: '[{"deliverable":"Reel","priceCents":320000}]',
      audience: '{"followers":"284k"}',
      brands: '["Figma"]',
      published: true,
    });
    expect(kit.rateCard[0].priceCents).toBe(320000);
    expect(kit.audience.followers).toBe("284k");
    expect(kit.brands).toEqual(["Figma"]);
  });

  it("survives corrupt JSON without throwing", () => {
    const kit = parseMediaKit({
      headline: "", about: "", rateCard: "{{{", audience: "nope", brands: "", published: false,
    });
    expect(kit.rateCard).toEqual([]);
    expect(kit.audience).toEqual({});
    expect(kit.brands).toEqual([]);
  });
});

describe("request classification", () => {
  it("detects device families from the user agent", () => {
    expect(deviceFrom("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe("mobile");
    expect(deviceFrom("Mozilla/5.0 (iPad; CPU OS 17_0)")).toBe("tablet");
    expect(deviceFrom("Mozilla/5.0 (Macintosh; Intel Mac OS X)")).toBe("desktop");
    expect(deviceFrom(null)).toBe("desktop");
  });

  it("reduces a referrer to a bare host", () => {
    expect(referrerFrom("https://www.instagram.com/p/abc")).toBe("instagram.com");
    expect(referrerFrom(null)).toBe("direct");
    expect(referrerFrom("garbage")).toBe("direct");
  });
});
