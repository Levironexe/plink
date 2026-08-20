import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  absoluteUrl,
  applicationFeeCents,
  destinationCharge,
  getStripe,
  planForPriceId,
  platformFeeBps,
  priceIdFor,
  siteUrl,
  stripeEnabled,
  StripeNotConfiguredError,
  webhookSecret,
} from "@plink/payments";

const KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PLATFORM_FEE_BPS",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_YEARLY",
  "STRIPE_PRICE_VIP_MONTHLY",
  "STRIPE_PRICE_VIP_YEARLY",
  "NEXT_PUBLIC_SITE_URL",
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("stripeEnabled", () => {
  it("treats missing and blank keys as not configured", () => {
    expect(stripeEnabled()).toBe(false);
    process.env.STRIPE_SECRET_KEY = "";
    expect(stripeEnabled()).toBe(false);
    process.env.STRIPE_SECRET_KEY = "   ";
    expect(stripeEnabled()).toBe(false);
  });

  it("is enabled once a key is present", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    expect(stripeEnabled()).toBe(true);
  });
});

describe("getStripe", () => {
  it("throws a typed error rather than constructing without a key", () => {
    expect(() => getStripe()).toThrow(StripeNotConfiguredError);
    expect(() => getStripe()).toThrow(/STRIPE_SECRET_KEY/);
  });

  it("reuses one client per key", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    expect(getStripe()).toBe(getStripe());
  });
});

describe("webhookSecret", () => {
  it("returns null when unset or blank", () => {
    expect(webhookSecret()).toBeNull();
    process.env.STRIPE_WEBHOOK_SECRET = "  ";
    expect(webhookSecret()).toBeNull();
  });

  it("trims the configured value", () => {
    process.env.STRIPE_WEBHOOK_SECRET = " whsec_example ";
    expect(webhookSecret()).toBe("whsec_example");
  });
});

describe("platformFeeBps", () => {
  it("defaults to 5% when unset, blank or unparseable", () => {
    expect(platformFeeBps()).toBe(500);
    process.env.STRIPE_PLATFORM_FEE_BPS = "";
    expect(platformFeeBps()).toBe(500);
    process.env.STRIPE_PLATFORM_FEE_BPS = "not-a-number";
    expect(platformFeeBps()).toBe(500);
    process.env.STRIPE_PLATFORM_FEE_BPS = "-100";
    expect(platformFeeBps()).toBe(500);
  });

  it("reads a configured value and clamps it to 100%", () => {
    process.env.STRIPE_PLATFORM_FEE_BPS = "250";
    expect(platformFeeBps()).toBe(250);
    process.env.STRIPE_PLATFORM_FEE_BPS = "0";
    expect(platformFeeBps()).toBe(0);
    process.env.STRIPE_PLATFORM_FEE_BPS = "99999";
    expect(platformFeeBps()).toBe(10_000);
  });
});

describe("priceIdFor", () => {
  it("returns null while the price vars are empty", () => {
    expect(priceIdFor("pro", "month")).toBeNull();
    expect(priceIdFor("vip", "year")).toBeNull();
  });

  it("maps each plan and interval to its own variable", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_m";
    process.env.STRIPE_PRICE_PRO_YEARLY = "price_pro_y";
    process.env.STRIPE_PRICE_VIP_MONTHLY = "price_vip_m";
    process.env.STRIPE_PRICE_VIP_YEARLY = "price_vip_y";

    expect(priceIdFor("pro", "month")).toBe("price_pro_m");
    expect(priceIdFor("pro", "year")).toBe("price_pro_y");
    expect(priceIdFor("vip", "month")).toBe("price_vip_m");
    expect(priceIdFor("vip", "year")).toBe("price_vip_y");
  });
});

describe("planForPriceId", () => {
  it("reverses the price lookup", () => {
    process.env.STRIPE_PRICE_VIP_YEARLY = "price_vip_y";
    expect(planForPriceId("price_vip_y")).toEqual({ plan: "vip", interval: "year" });
  });

  it("returns null for unknown or missing ids", () => {
    expect(planForPriceId("price_unknown")).toBeNull();
    expect(planForPriceId(null)).toBeNull();
    expect(planForPriceId(undefined)).toBeNull();
  });
});

describe("absoluteUrl", () => {
  it("falls back to localhost when the site URL is unset", () => {
    expect(siteUrl()).toBe("http://localhost:3000");
    expect(absoluteUrl("/dashboard/billing")).toBe("http://localhost:3000/dashboard/billing");
  });

  it("normalises slashes on both sides of the join", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://plink.to/";
    expect(absoluteUrl("/maya")).toBe("https://plink.to/maya");
    expect(absoluteUrl("maya")).toBe("https://plink.to/maya");
    expect(absoluteUrl()).toBe("https://plink.to/");
  });

  it("passes an already absolute URL through untouched", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://plink.to";
    expect(absoluteUrl("https://files.example.com/a.zip")).toBe("https://files.example.com/a.zip");
  });
});

describe("applicationFeeCents", () => {
  it("takes the default 5% from free accounts", () => {
    expect(applicationFeeCents(2000, "free")).toBe(100);
    expect(applicationFeeCents(999, "free")).toBe(50); // 49.95 rounds up
  });

  it("charges paid plans nothing", () => {
    expect(applicationFeeCents(2000, "pro")).toBe(0);
    expect(applicationFeeCents(2000, "vip")).toBe(0);
  });

  it("honours a configured fee and never exceeds the sale", () => {
    process.env.STRIPE_PLATFORM_FEE_BPS = "1000";
    expect(applicationFeeCents(2000, "free")).toBe(200);
    expect(applicationFeeCents(2000, "free", 0)).toBe(0);
    expect(applicationFeeCents(2000, "free", 20_000)).toBe(2000);
  });

  it("returns nothing for a non-positive amount", () => {
    expect(applicationFeeCents(0, "free")).toBe(0);
    expect(applicationFeeCents(-500, "free")).toBe(0);
    expect(applicationFeeCents(Number.NaN, "free")).toBe(0);
  });
});

describe("destinationCharge", () => {
  it("is null until the creator can actually be paid", () => {
    expect(destinationCharge(2000, { stripeAccountId: null, payoutsEnabled: false, plan: "free" })).toBeNull();
    expect(destinationCharge(2000, { stripeAccountId: "acct_1", payoutsEnabled: false, plan: "free" })).toBeNull();
    expect(destinationCharge(2000, { stripeAccountId: null, payoutsEnabled: true, plan: "free" })).toBeNull();
  });

  it("routes the sale with the plan's fee attached", () => {
    expect(destinationCharge(2000, { stripeAccountId: "acct_1", payoutsEnabled: true, plan: "free" })).toEqual({
      destination: "acct_1",
      applicationFeeAmount: 100,
    });
    expect(destinationCharge(2000, { stripeAccountId: "acct_1", payoutsEnabled: true, plan: "pro" })).toEqual({
      destination: "acct_1",
      applicationFeeAmount: 0,
    });
  });
});
