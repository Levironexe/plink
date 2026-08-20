import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function compactNumber(n: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function slugifyUsername(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 30);
}

export const RESERVED_USERNAMES = new Set([
  "api", "dashboard", "login", "signup", "signin", "signout", "logout", "onboarding",
  "pricing", "templates", "explore", "about", "blog", "help", "support", "terms",
  "privacy", "admin", "settings", "account", "www", "app", "static", "_next",
  "assets", "images", "favicon.ico", "robots.txt", "sitemap.xml", "features", "u",
]);

export function isReservedUsername(u: string) {
  return RESERVED_USERNAMES.has(u.toLowerCase());
}

/** Schemes that can execute script or smuggle content if rendered in an href. */
const DANGEROUS_SCHEME = /^\s*(javascript|data|vbscript|file|blob):/i;
const SAFE_SCHEME = /^(https?:|mailto:|tel:|sms:|#|\/)/i;

/**
 * Normalises a creator-supplied destination into something safe to put in an
 * href. Anything with a scriptable scheme is neutralised rather than upgraded.
 */
export function safeUrl(raw: string) {
  if (!raw) return "#";
  const value = raw.trim();
  if (DANGEROUS_SCHEME.test(value)) return "#";
  if (SAFE_SCHEME.test(value)) return value;
  // A bare host such as "example.com/path" — assume https.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return "#";
  return `https://${value}`;
}

export function hostOf(raw: string) {
  try {
    return new URL(safeUrl(raw)).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function relativeTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
