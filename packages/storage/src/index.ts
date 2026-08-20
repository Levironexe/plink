/**
 * Server-side upload helpers for Vercel Blob.
 *
 * Two rules shape this module:
 *
 * 1. **Nothing is constructed at import time.** `BLOB_READ_WRITE_TOKEN` is
 *    optional — with it unset the app still builds, renders and runs, and every
 *    upload path fails with a clear, actionable message instead of crashing.
 *    The Blob SDK itself is loaded lazily so an unconfigured deploy never even
 *    pays for the import.
 * 2. **The caller never picks the object key.** A filename arriving from a
 *    browser is untrusted input: it is normalised, stripped of every path
 *    segment and re-slugged before it is joined onto the owner's prefix, so a
 *    name can only ever contribute a leaf.
 */
import { customAlphabet } from "nanoid";
import { z } from "zod";

/* ── Kinds ────────────────────────────────────────────────────────────────── */

export const UPLOAD_KINDS = ["avatar", "banner", "block", "product-image", "product-file"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];
export const uploadKindSchema = z.enum(UPLOAD_KINDS);

/** Every kind but `product-file` is rendered as an image somewhere public. */
const IMAGE_KINDS: ReadonlySet<string> = new Set<UploadKind>([
  "avatar",
  "banner",
  "block",
  "product-image",
]);

/* ── Allowlists ───────────────────────────────────────────────────────────── */

/**
 * Images are an allowlist, never a blocklist. `image/svg+xml` is excluded on
 * purpose: SVG is a document format that can carry script, and blobs are served
 * from a CDN origin where that script would run. `text/html` is excluded for
 * the same reason.
 */
export const IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

/** Digital goods: documents, archives and media that browsers download. */
export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/epub+zip",
  "audio/mpeg",
  "video/mp4",
] as const;

const IMAGE_SET: ReadonlySet<string> = new Set<string>(IMAGE_MIME_TYPES);
const DOCUMENT_SET: ReadonlySet<string> = new Set<string>(DOCUMENT_MIME_TYPES);

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** Vercel Functions accept request bodies up to 100 MB. */
export const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024;

/** Comma-separated values for an `<input type="file" accept="…">`. */
export const IMAGE_ACCEPT = IMAGE_MIME_TYPES.join(",");
export const DOCUMENT_ACCEPT = [...DOCUMENT_MIME_TYPES, ".pdf", ".zip", ".epub", ".mp3", ".mp4"].join(",");

const IMAGE_LABEL = "PNG, JPG, WEBP, GIF or AVIF";
const DOCUMENT_LABEL = "PDF, ZIP, EPUB, MP3 or MP4";

/* ── Formatting ───────────────────────────────────────────────────────────── */

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} ${units[i]}`;
}

/** `image/JPEG; charset=binary` → `image/jpeg`. */
export function normalizeMimeType(raw: string | null | undefined) {
  return (raw ?? "").split(";")[0]!.trim().toLowerCase();
}

/* ── Validation ───────────────────────────────────────────────────────────── */

export type UploadCandidate = { type: string; size: number };
export type ValidationResult =
  | { ok: true; contentType: string }
  | { ok: false; message: string };

function validate(
  file: UploadCandidate,
  allowed: ReadonlySet<string>,
  maxBytes: number,
  label: string,
): ValidationResult {
  const contentType = normalizeMimeType(file.type);

  if (!contentType) return { ok: false, message: `That file has no type. Use ${label}.` };
  if (!allowed.has(contentType)) {
    return { ok: false, message: `${contentType} isn't supported. Use ${label}.` };
  }

  const size = Number(file.size);
  if (!Number.isFinite(size) || size <= 0) return { ok: false, message: "That file is empty." };
  if (size > maxBytes) {
    return {
      ok: false,
      message: `That file is ${formatBytes(size)}. The limit is ${formatBytes(maxBytes)}.`,
    };
  }

  return { ok: true, contentType };
}

/** Images: allowlisted raster formats only, 8 MB cap. */
export function validateImage(file: UploadCandidate): ValidationResult {
  return validate(file, IMAGE_SET, MAX_IMAGE_BYTES, IMAGE_LABEL);
}

/** Documents and digital goods: 100 MB cap. */
export function validateDocument(file: UploadCandidate): ValidationResult {
  return validate(file, DOCUMENT_SET, MAX_DOCUMENT_BYTES, DOCUMENT_LABEL);
}

/** Dispatches to the right validator for an upload kind. */
export function validateUpload(kind: UploadKind, file: UploadCandidate): ValidationResult {
  return IMAGE_KINDS.has(kind) ? validateImage(file) : validateDocument(file);
}

export function maxBytesFor(kind: UploadKind) {
  return IMAGE_KINDS.has(kind) ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
}

/* ── Object keys ──────────────────────────────────────────────────────────── */

/**
 * Letters that NFKD leaves intact because they are distinct glyphs rather than
 * a base plus a diacritic. Without this, "cødé" would slug to "c-d".
 */
const TRANSLITERATIONS: Record<string, string> = {
  "\u00f8": "o", "\u00d8": "o", "\u00e6": "ae", "\u00c6": "ae",
  "\u0153": "oe", "\u0152": "oe", "\u00df": "ss", "\u00f0": "d",
  "\u00d0": "d", "\u00fe": "th", "\u00de": "th", "\u0111": "d",
  "\u0110": "d", "\u0142": "l", "\u0141": "l", "\u0131": "i",
};

function transliterate(value: string) {
  return value.replace(/[^\u0000-\u007f]/g, (ch) => TRANSLITERATIONS[ch] ?? ch);
}

/** Lowercase alphanumerics only: the suffix can never introduce new syntax. */
const randomSuffix = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);

/**
 * Turns an untrusted filename into a safe, collision-resistant leaf name.
 *
 * The result is always `[a-z0-9-]+` with at most one `.ext`, so it cannot
 * contain a path separator, a `..` segment, a query string or a leading dot —
 * joining it onto a prefix can never escape that prefix.
 */
export function slugifyFilename(name: string) {
  // Normalise first: NFKD folds look-alikes such as U+FF0F FULLWIDTH SOLIDUS
  // down to a plain "/", so separator stripping below sees them too.
  const normalized = transliterate(
    String(name ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, ""),
  );

  // A caller-supplied name may only ever contribute the final segment.
  const leaf = normalized.split(/[/\\]+/).pop() ?? "";

  const dot = leaf.lastIndexOf(".");
  const rawStem = dot > 0 ? leaf.slice(0, dot) : leaf;
  const rawExt = dot > 0 ? leaf.slice(dot + 1) : "";

  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const stem =
    rawStem
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/, "") || "file";

  const base = `${stem}-${randomSuffix()}`;
  return ext ? `${base}.${ext}` : base;
}

/** User ids come from the session, but they are still scrubbed before use. */
function safeSegment(value: string) {
  return String(value ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

/** The prefix every object owned by `userId` lives under. */
export function userPrefix(userId: string) {
  return `u/${safeSegment(userId)}`;
}

/** `u/<userId>/<kind>/<safe-name>` — the only key shape this app writes. */
export function objectKey(userId: string, kind: UploadKind, filename: string) {
  return `${userPrefix(userId)}/${kind}/${slugifyFilename(filename)}`;
}

/**
 * Reduces a blob URL or raw pathname to a store pathname, or `null` when the
 * input is unusable. Decoding happens before the traversal check so a
 * percent-encoded `%2e%2e` cannot slip through.
 */
export function pathnameFromUrl(input: string): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  let pathname = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      pathname = new URL(raw).pathname;
    } catch {
      return null;
    }
  }

  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  pathname = pathname.replace(/^\/+/, "");
  if (!pathname || pathname.includes("..")) return null;
  return pathname;
}

/**
 * True only when the object sits under the calling user's own prefix. Used to
 * stop one creator deleting another creator's files.
 */
export function ownsObject(userId: string, urlOrPathname: string) {
  const id = safeSegment(userId);
  if (!id) return false;
  const pathname = pathnameFromUrl(urlOrPathname);
  if (!pathname) return false;
  return pathname.startsWith(`${userPrefix(id)}/`);
}

/* ── Blob store ───────────────────────────────────────────────────────────── */

export const UPLOAD_NOT_CONFIGURED_MESSAGE =
  "File uploads aren't configured. Add a BLOB_READ_WRITE_TOKEN from your Vercel Blob store to .env.local and restart the server — until then, paste a URL instead.";

export class UploadNotConfiguredError extends Error {
  constructor() {
    super(UPLOAD_NOT_CONFIGURED_MESSAGE);
    this.name = "UploadNotConfiguredError";
  }
}

/** Read lazily and never logged — an empty token simply disables uploads. */
function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || "";
}

/** Whether a Blob store is wired up. Safe to call anywhere, including at build. */
export function uploadEnabled() {
  return blobToken().length > 0;
}

export type UploadBody = Blob | ArrayBuffer | ReadableStream | string;

export type StoredObject = {
  url: string;
  downloadUrl: string;
  pathname: string;
  contentType: string;
};

/**
 * Writes an object to the store. `addRandomSuffix` is on so two uploads of the
 * same name can never overwrite each other — the returned pathname is the
 * authoritative one and still carries the owner's prefix.
 */
export async function putObject({
  pathname,
  body,
  contentType,
}: {
  pathname: string;
  body: UploadBody;
  contentType?: string;
}): Promise<StoredObject> {
  const token = blobToken();
  if (!token) throw new UploadNotConfiguredError();

  const { put } = await import("@vercel/blob");
  const blob = await put(pathname, body, {
    access: "public",
    addRandomSuffix: true,
    contentType,
    token,
  });

  return {
    url: blob.url,
    downloadUrl: blob.downloadUrl,
    pathname: blob.pathname,
    contentType: blob.contentType,
  };
}

/** Removes an object. Callers must check {@link ownsObject} first. */
export async function deleteObject(pathnameOrUrl: string): Promise<void> {
  const token = blobToken();
  if (!token) throw new UploadNotConfiguredError();

  const { del } = await import("@vercel/blob");
  await del(pathnameOrUrl, { token });
}
