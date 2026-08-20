import { describe, expect, it } from "vitest";
import {
  DOMAIN_CNAME_TARGET,
  DOMAIN_TXT_HOST,
  domainRecords,
  domainTxtHostname,
  domainTxtValue,
  isApexDomain,
  isPlatformDomain,
  newDomainToken,
  normalizeDomain,
  normalizeOrigin,
  publicPageUrl,
  verifyDomainTxt,
} from "@plink/core/domains";

function accepted(raw: string) {
  const result = normalizeDomain(raw);
  expect(result.ok, `expected ${raw} to be accepted`).toBe(true);
  return result.ok ? result.domain : "";
}

function rejected(raw: string) {
  const result = normalizeDomain(raw);
  expect(result.ok, `expected ${raw} to be rejected`).toBe(false);
  return result.ok ? "" : result.error;
}

describe("normalizeDomain", () => {
  it("accepts a plain apex domain", () => {
    expect(accepted("example.com")).toBe("example.com");
  });

  it("lowercases and trims", () => {
    expect(accepted("  Links.Example.COM  ")).toBe("links.example.com");
  });

  it("drops a single fully-qualified trailing dot", () => {
    expect(accepted("example.com.")).toBe("example.com");
  });

  it("accepts sub-domains, dashes and digits", () => {
    expect(accepted("go.my-shop2.co.uk")).toBe("go.my-shop2.co.uk");
    expect(accepted("xn--bcher-kva.de")).toBe("xn--bcher-kva.de");
  });

  it("rejects a protocol", () => {
    expect(rejected("https://example.com")).toMatch(/https:\/\//);
    expect(rejected("http://example.com")).toMatch(/https:\/\//);
    expect(rejected("mailto:me@example.com")).toBeTruthy();
  });

  it("rejects a path, query or port", () => {
    expect(rejected("example.com/links")).toMatch(/path/);
    expect(rejected("example.com?utm=1")).toMatch(/query/);
    expect(rejected("example.com:3000")).toMatch(/port/);
  });

  it("rejects our own domain and anything under it", () => {
    expect(rejected("plink.to")).toMatch(/ours/);
    expect(rejected("me.plink.to")).toMatch(/ours/);
  });

  it("rejects empty, spaced and non-ASCII input", () => {
    expect(rejected("")).toBe("Enter a domain");
    expect(rejected("   ")).toBe("Enter a domain");
    expect(rejected("my site.com")).toMatch(/spaces/);
    expect(rejected("bücher.de")).toMatch(/punycode/);
  });

  it("rejects obvious typos", () => {
    expect(rejected("example.con")).toBe("Did you mean .com?");
    expect(rejected("example.ogr")).toBe("Did you mean .org?");
    expect(rejected("example..com")).toMatch(/dots/);
    expect(rejected(".example.com")).toMatch(/dots/);
    expect(rejected("example")).toMatch(/domain ending/);
    expect(rejected("example.c0m")).toBeTruthy();
    expect(rejected("-example.com")).toMatch(/letters, numbers and dashes/);
    expect(rejected("example-.com")).toMatch(/letters, numbers and dashes/);
  });

  it("rejects hosts that cannot resolve publicly", () => {
    expect(rejected("localhost")).toBeTruthy();
    expect(rejected("site.localhost")).toMatch(/public internet/);
    expect(rejected("site.test")).toMatch(/public internet/);
    expect(rejected("127.0.0.1")).toMatch(/IP address/);
  });

  it("rejects email addresses and over-long labels", () => {
    expect(rejected("me@example.com")).toMatch(/email/);
    expect(rejected(`${"a".repeat(64)}.com`)).toMatch(/too long/);
    expect(
      rejected(`${"a".repeat(60)}.${"b".repeat(60)}.${"c".repeat(60)}.${"d".repeat(60)}.${"e".repeat(60)}.com`),
    ).toMatch(/too long/);
  });
});

describe("isPlatformDomain / isApexDomain", () => {
  it("spots our apex in any casing", () => {
    expect(isPlatformDomain("PLINK.TO")).toBe(true);
    expect(isPlatformDomain("a.plink.to.")).toBe(true);
    expect(isPlatformDomain("notplink.to")).toBe(false);
  });

  it("distinguishes an apex from a sub-domain", () => {
    expect(isApexDomain("example.com")).toBe(true);
    expect(isApexDomain("links.example.com")).toBe(false);
  });
});

describe("dns records", () => {
  it("gives an apex an A record and a sub-domain a CNAME", () => {
    const apex = domainRecords("example.com", "tok123");
    expect(apex[0].type).toBe("A");
    expect(apex[0].name).toBe("@");

    const sub = domainRecords("links.example.com", "tok123");
    expect(sub[0].type).toBe("CNAME");
    expect(sub[0].name).toBe("links");
    expect(sub[0].value).toBe(DOMAIN_CNAME_TARGET);
  });

  it("always includes the verification TXT record", () => {
    const [, txt] = domainRecords("example.com", "tok123");
    expect(txt.type).toBe("TXT");
    expect(txt.name).toBe(DOMAIN_TXT_HOST);
    expect(txt.value).toBe("plink-domain-verify=tok123");
    expect(domainTxtHostname("example.com")).toBe("_plink.example.com");
  });

  it("mints unique tokens", () => {
    expect(newDomainToken()).not.toBe(newDomainToken());
    expect(newDomainToken().length).toBeGreaterThanOrEqual(16);
  });
});

describe("verifyDomainTxt", () => {
  it("verifies when the record matches", async () => {
    const result = await verifyDomainTxt("example.com", "tok123", async (hostname) => {
      expect(hostname).toBe("_plink.example.com");
      return [["other=1"], ["plink-domain-verify=tok123"]];
    });

    expect(result.verified).toBe(true);
    expect(result.expected).toBe(domainTxtValue("tok123"));
    expect(result.error).toBeUndefined();
  });

  it("joins chunked TXT answers before comparing", async () => {
    const result = await verifyDomainTxt("example.com", "tok123", async () => [
      ["plink-domain-verify=", "tok123"],
    ]);
    expect(result.verified).toBe(true);
  });

  it("accepts a bare token as well as the prefixed form", async () => {
    const result = await verifyDomainTxt("example.com", "tok123", async () => [["tok123"]]);
    expect(result.verified).toBe(true);
  });

  it("fails when the record is missing or stale", async () => {
    const stale = await verifyDomainTxt("example.com", "tok123", async () => [["plink-domain-verify=old"]]);
    expect(stale.verified).toBe(false);
    expect(stale.found).toEqual(["plink-domain-verify=old"]);
    expect(stale.error).toBeTruthy();
  });

  it("turns a DNS lookup failure into a friendly message", async () => {
    const missing = await verifyDomainTxt("example.com", "tok123", async () => {
      const error = new Error("queryTxt ENOTFOUND") as NodeJS.ErrnoException;
      error.code = "ENOTFOUND";
      throw error;
    });

    expect(missing.verified).toBe(false);
    expect(missing.error).toMatch(/DNS can take a few minutes/);

    const broken = await verifyDomainTxt("example.com", "tok123", async () => {
      throw new Error("boom");
    });
    expect(broken.verified).toBe(false);
    expect(broken.error).toMatch(/Could not read DNS/);
  });
});

describe("publicPageUrl", () => {
  it("prefers a verified custom domain", () => {
    expect(
      publicPageUrl(
        { username: "mia", customDomain: "mia.com", domainVerifiedAt: new Date() },
        "https://plink.to",
      ),
    ).toBe("https://mia.com");
  });

  it("falls back to the platform URL until the domain is verified", () => {
    expect(
      publicPageUrl({ username: "mia", customDomain: "mia.com", domainVerifiedAt: null }, "https://plink.to/"),
    ).toBe("https://plink.to/mia");
    expect(publicPageUrl({ username: "mia" }, "https://plink.to")).toBe("https://plink.to/mia");
  });

  it("normalises origins", () => {
    expect(normalizeOrigin("https://plink.to///")).toBe("https://plink.to");
  });
});
