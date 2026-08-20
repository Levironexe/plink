/**
 * Custom domains — hostname validation, the DNS records a creator has to add,
 * and TXT-record ownership verification.
 *
 * This module is deliberately free of server-only imports so the dashboard can
 * render the DNS instructions from the same source of truth the API verifies
 * against. The DNS lookup itself is injected: the route handler passes Node's
 * `resolveTxt` from `node:dns/promises`, and tests pass a stub.
 */

import { nanoid } from "nanoid";

/** Our own apex. A creator cannot claim it or anything under it. */
export const PLATFORM_DOMAIN = "plink.to";

/** Where a connected domain has to point. */
export const DOMAIN_CNAME_TARGET = "cname.plink.to";
/** The A record to use instead when the domain is an apex (no CNAME allowed). */
export const DOMAIN_A_TARGET = "76.76.21.21";

/** Sub-domain that carries the ownership proof. */
export const DOMAIN_TXT_HOST = "_plink";
export const DOMAIN_TXT_PREFIX = "plink-domain-verify";

export type DnsRecordType = "CNAME" | "TXT" | "A";

export type DnsRecord = {
  type: DnsRecordType;
  /** Host as most DNS panels want it typed. */
  name: string;
  value: string;
  ttl: string;
  hint?: string;
};

export type DomainResult = { ok: true; domain: string } | { ok: false; error: string };

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const TLD = /^[a-z]{2,}$/;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/** Fat-finger TLDs worth catching before someone waits on DNS that never resolves. */
const TLD_TYPOS: Record<string, string> = {
  con: "com",
  cmo: "com",
  ocm: "com",
  comm: "com",
  vom: "com",
  xom: "com",
  cim: "com",
  nte: "net",
  ent: "net",
  nett: "net",
  ogr: "org",
  rog: "org",
  orgg: "org",
};

/** Reserved endings that never resolve publicly (RFC 2606 / 6761). */
const RESERVED_TLDS = new Set(["localhost", "local", "localdomain", "example", "invalid", "test", "internal"]);

/**
 * Normalise creator input into a bare hostname, or explain why we will not take
 * it. We reject rather than repair anything ambiguous — silently turning
 * `https://shop.me/store` into `shop.me` hides a mistake the creator should see.
 */
export function normalizeDomain(raw: string): DomainResult {
  const input = (raw ?? "").trim();
  if (!input) return { ok: false, error: "Enter a domain" };
  if (/\s/.test(input)) return { ok: false, error: "A domain cannot contain spaces" };

  const lower = input.toLowerCase();

  if (lower.includes("://")) {
    return { ok: false, error: "Leave off the https:// — just the domain" };
  }
  // `example.com:3000` is a port; `mailto:me` is a scheme. Check the port shape
  // first so the more specific message wins.
  if (/:\d/.test(lower)) return { ok: false, error: "Leave off the port — just the domain" };
  if (/^[a-z][a-z0-9+.-]*:/.test(lower)) {
    return { ok: false, error: "Leave off the https:// — just the domain" };
  }
  if (lower.includes("/")) return { ok: false, error: "Leave off the path — just the domain" };
  if (lower.includes(":")) return { ok: false, error: "Leave off the port — just the domain" };
  if (lower.includes("@")) return { ok: false, error: "That looks like an email address" };
  if (lower.includes("?") || lower.includes("#")) {
    return { ok: false, error: "Leave off the query string — just the domain" };
  }
  if (!/^[\x20-\x7e]+$/.test(lower)) {
    return { ok: false, error: "Use the punycode (xn--) form of an international domain" };
  }

  // A single trailing dot is a valid fully-qualified form; anything else is a slip.
  const host = lower.replace(/\.$/, "");
  if (host.length > 253) return { ok: false, error: "That domain is too long" };
  if (host.startsWith(".") || host.includes("..")) {
    return { ok: false, error: "Check the dots in that domain" };
  }
  if (IPV4.test(host)) return { ok: false, error: "Point a domain here, not an IP address" };

  const labels = host.split(".");
  if (labels.length < 2) return { ok: false, error: "Add a domain ending, like .com" };
  if (labels.length > 6) return { ok: false, error: "That domain has too many parts" };

  for (const label of labels) {
    if (!label) return { ok: false, error: "Check the dots in that domain" };
    if (label.length > 63) return { ok: false, error: "One part of that domain is too long" };
    if (!LABEL.test(label)) {
      return { ok: false, error: "Use letters, numbers and dashes only" };
    }
  }

  const tld = labels[labels.length - 1];
  if (RESERVED_TLDS.has(tld)) {
    return { ok: false, error: "That domain will not resolve on the public internet" };
  }
  if (!TLD.test(tld)) return { ok: false, error: "That domain ending does not look right" };

  const suggestion = TLD_TYPOS[tld];
  if (suggestion && suggestion !== tld) {
    return { ok: false, error: `Did you mean .${suggestion}?` };
  }

  if (isPlatformDomain(host)) {
    return { ok: false, error: `${PLATFORM_DOMAIN} is ours — connect a domain you own` };
  }

  return { ok: true, domain: host };
}

/** True for our apex and anything beneath it. */
export function isPlatformDomain(host: string): boolean {
  const clean = host.trim().toLowerCase().replace(/\.$/, "");
  return clean === PLATFORM_DOMAIN || clean.endsWith(`.${PLATFORM_DOMAIN}`);
}

/** A two-label domain has no sub-domain, so it cannot take a CNAME at the root. */
export function isApexDomain(host: string): boolean {
  return host.split(".").length === 2;
}

/** A fresh ownership token. Stored on the user and published as a TXT record. */
export function newDomainToken(): string {
  return nanoid(24);
}

/** The exact TXT value we look for. */
export function domainTxtValue(token: string): string {
  return `${DOMAIN_TXT_PREFIX}=${token}`;
}

/** The hostname the TXT record lives on. */
export function domainTxtHostname(domain: string): string {
  return `${DOMAIN_TXT_HOST}.${domain}`;
}

/**
 * Everything the creator has to paste into their DNS panel. Apex domains get an
 * A record because a root CNAME is illegal in most zones.
 */
export function domainRecords(domain: string, token: string): DnsRecord[] {
  const apex = isApexDomain(domain);
  const subdomain = apex ? "@" : domain.split(".")[0];

  return [
    apex
      ? {
          type: "A",
          name: "@",
          value: DOMAIN_A_TARGET,
          ttl: "3600",
          hint: "Root domains cannot take a CNAME — use this A record, or an ALIAS to " + DOMAIN_CNAME_TARGET,
        }
      : {
          type: "CNAME",
          name: subdomain,
          value: DOMAIN_CNAME_TARGET,
          ttl: "3600",
          hint: `Points ${domain} at Plink`,
        },
    {
      type: "TXT",
      name: DOMAIN_TXT_HOST,
      value: domainTxtValue(token),
      ttl: "3600",
      hint: "Proves you own the domain. Safe to remove once verified.",
    },
  ];
}

/** Matches the shape of `resolveTxt` from `node:dns/promises`. */
export type TxtResolver = (hostname: string) => Promise<string[][]>;

export type DomainVerification = {
  verified: boolean;
  hostname: string;
  expected: string;
  found: string[];
  error?: string;
};

/**
 * Look for our proof in the domain's TXT records. Long values are split into
 * 255-character chunks on the wire, so each answer is joined before comparing,
 * and a bare token is accepted alongside the prefixed form.
 */
export async function verifyDomainTxt(
  domain: string,
  token: string,
  resolveTxt: TxtResolver,
): Promise<DomainVerification> {
  const hostname = domainTxtHostname(domain);
  const expected = domainTxtValue(token);

  let records: string[][];
  try {
    records = await resolveTxt(hostname);
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    return {
      verified: false,
      hostname,
      expected,
      found: [],
      error:
        code === "ENOTFOUND" || code === "ENODATA"
          ? "No TXT record found yet — DNS can take a few minutes"
          : "Could not read DNS for that domain",
    };
  }

  const found = records.map((chunks) => chunks.join("").trim()).filter(Boolean);
  const verified = found.some((value) => value === expected || value === token);

  return {
    verified,
    hostname,
    expected,
    found,
    error: verified ? undefined : "That TXT record has not propagated yet",
  };
}

/** Strip a trailing slash so origins concatenate predictably. */
export function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

/**
 * Where a creator's page actually lives — their verified domain if they have
 * one, otherwise the platform URL.
 */
export function publicPageUrl(
  user: {
    username: string;
    customDomain?: string | null;
    domainVerifiedAt?: Date | string | null;
  },
  origin: string,
): string {
  if (user.customDomain && user.domainVerifiedAt) {
    return `https://${user.customDomain}`;
  }
  return `${normalizeOrigin(origin)}/${user.username}`;
}
