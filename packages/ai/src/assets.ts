/**
 * AI Asset Generator — hero / banner / thumbnail images.
 *
 * Two boundaries shape this module:
 *
 * 1. **It generates, it does not store.** The function returns raw bytes; the
 *    API route uploads them through `@plink/storage` under the caller's own
 *    prefix. Storage never becomes a dependency of `@plink/ai`, so this file
 *    stays unit-testable with a single `vi.mock("ai")` and the one-way
 *    dependency direction (constitution V.1) holds.
 * 2. **Nothing is read at import.** The gateway key and the model id are both
 *    resolved on every call, so the app builds and boots with a blank
 *    `.env.local` and a key added later takes effect on the next request.
 *
 * The image API here was verified against the installed `ai@7.0.70` rather
 * than assumed — see `docs/spikes/2026-09-03-ai-sdk-image-generation.md`. In
 * this version the export is `generateImage`; the `experimental_` spelling
 * older docs use no longer exists.
 */

import { generateImage } from "ai";
import { aiEnabled, clampText } from "./index";

export const ASSET_KINDS = ["hero", "banner", "thumbnail"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

/** Longest operator prompt we send. Anything past this is trimmed, not refused. */
export const ASSET_PROMPT_MAX = 600;

/**
 * What we accept back from a model. An allowlist, never a blocklist, and
 * deliberately narrower than the storage package's: `image/svg+xml` is a
 * document format that can carry script, and generated blobs are served from a
 * CDN origin where that script would run (constitution I.4).
 */
export const ASSET_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/**
 * Resolved by the Vercel AI Gateway from this plain `"provider/model"` string,
 * exactly as the text models in `./index` are. The fast tier is the right
 * default for decorative page art — see the spike for why `imagen-4` over the
 * `gpt-image` family (it takes an aspect ratio rather than three fixed sizes).
 */
export const DEFAULT_IMAGE_MODEL = "google/imagen-4.0-fast-generate-001";

/** Give up rather than hold a serverless function open indefinitely. */
const GENERATION_TIMEOUT_MS = 60_000;

const MIME_SET: ReadonlySet<string> = new Set<string>(ASSET_MIME_TYPES);

export type GenerateAssetInput = {
  kind: AssetKind;
  /** Operator prompt, clamped by the implementation. */
  prompt: string;
};

export type GeneratedAsset = {
  /** Raw image bytes. The caller stores them; this package never uploads. */
  bytes: Uint8Array;
  mimeType: string;
};

/* ─────────────────────────────────────────────────────────────
   Kinds — geometry and framing, in one table
   ───────────────────────────────────────────────────────────── */

type KindSpec = {
  /** Format the SDK requires: `{width}:{height}`. */
  aspectRatio: `${number}:${number}`;
  /** Prepended to the operator's own words. */
  framing: string;
};

const KIND_SPECS: Record<AssetKind, KindSpec> = {
  hero: {
    aspectRatio: "16:9",
    framing:
      "A wide 16:9 hero banner illustration for the top of a website. Cinematic, " +
      "editorial composition with the subject off-centre and calm, uncluttered space " +
      "on one side where a headline will sit.",
  },
  banner: {
    aspectRatio: "16:9",
    // The default model tops out at 16:9, so we ask for an ultra-wide
    // *composition* with room to spare vertically: cropping it to a strip must
    // not cut the subject. See the spike for the 21:9 escape hatch.
    framing:
      "An ultra-wide banner strip for a website section. Panoramic, horizontally " +
      "flowing composition with generous empty margin above and below the subject, " +
      "so it survives being cropped to a narrow band.",
  },
  thumbnail: {
    aspectRatio: "1:1",
    framing:
      "A square thumbnail image for a card in a grid. One clear subject, centred, " +
      "simple background, strong silhouette that stays readable at 200 pixels wide.",
  },
};

/** House rules every kind shares — the model has no business inventing these. */
const HOUSE_RULES = [
  "Do not render any text, letters, numbers, logos, watermarks or signatures.",
  "Do not depict real, recognisable people.",
  "Keep the palette cohesive and the lighting natural.",
].join(" ");

export function isAssetKind(value: unknown): value is AssetKind {
  return typeof value === "string" && (ASSET_KINDS as readonly string[]).includes(value);
}

/**
 * The gateway model id for image work. Read on every call so an operator whose
 * account lacks the default model can repoint `AI_IMAGE_MODEL` without a
 * redeploy — the failure path in `generateAssetImage` names the model for
 * exactly that reason.
 */
export function assetImageModel(): string {
  return process.env.AI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
}

/**
 * Builds the full prompt sent to the image model. Pure: same input, same
 * output, no I/O, never throws — so the interesting part of this module can be
 * tested without touching a provider.
 *
 * The operator's words are clamped through the same `clampText` the page
 * builder uses, which strips control characters and trims to
 * {@link ASSET_PROMPT_MAX}.
 */
export function composeAssetPrompt(kind: AssetKind, prompt: string): string {
  const spec = KIND_SPECS[kind] ?? KIND_SPECS.hero;
  const subject = clampText(prompt, ASSET_PROMPT_MAX);
  return [spec.framing, `Subject: ${subject}`, HOUSE_RULES].join("\n\n");
}

/* ─────────────────────────────────────────────────────────────
   Generation
   ───────────────────────────────────────────────────────────── */

/** `image/PNG; charset=binary` → `image/png`. */
function normalizeMediaType(raw: string | null | undefined): string {
  return (raw ?? "").split(";")[0]!.trim().toLowerCase();
}

/**
 * One sentence an operator can act on, never a stack trace and never anything
 * derived from the key. A gateway that has no entitlement for image models is
 * the single most likely failure here, so the model id is always named.
 */
function generationFailed(model: string, error: unknown): Error {
  const detail = error instanceof Error && error.message ? error.message : "the gateway rejected the request";
  return new Error(`Image generation failed for "${model}": ${detail}`);
}

/**
 * Generates one image through the AI Gateway and hands back its bytes.
 *
 * Throws — never crashes the process — with a message the studio can show:
 * `"AI is not configured"` when the key is absent, and a single explanatory
 * sentence when the gateway rejects the model or returns something unusable.
 */
export async function generateAssetImage({ kind, prompt }: GenerateAssetInput): Promise<GeneratedAsset> {
  // Call-time key check (constitution I.3). Before any SDK work, so an
  // unconfigured deploy pays nothing and says exactly what is missing.
  if (!aiEnabled()) throw new Error("AI is not configured");

  if (!isAssetKind(kind)) throw new Error(`Unknown asset kind: ${String(kind)}`);

  const subject = clampText(prompt, ASSET_PROMPT_MAX);
  if (!subject) throw new Error("Describe the image you want before generating");

  const model = assetImageModel();

  let result: Awaited<ReturnType<typeof generateImage>>;
  try {
    result = await generateImage({
      model,
      prompt: composeAssetPrompt(kind, prompt),
      aspectRatio: KIND_SPECS[kind].aspectRatio,
      n: 1,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    });
  } catch (error) {
    throw generationFailed(model, error);
  }

  // Unsupported settings come back as warnings rather than throwing, so the
  // request we made and the request the provider honoured can differ.
  if (result.warnings?.length) {
    console.warn(`[ai/assets] ${model} returned ${result.warnings.length} warning(s)`);
  }

  const image = result.image;
  if (!image) throw new Error(`"${model}" returned no image. Try a different prompt.`);

  const mimeType = normalizeMediaType(image.mediaType);
  if (!MIME_SET.has(mimeType)) {
    throw new Error(`"${model}" returned ${mimeType || "an unknown format"}. Only PNG, JPEG and WebP are stored.`);
  }

  const bytes = image.uint8Array;
  if (!bytes?.byteLength) throw new Error(`"${model}" returned an empty image. Try again.`);

  return { bytes, mimeType };
}
