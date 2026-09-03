import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@plink/db";
import { aiEnabled } from "@plink/ai";
import { ASSET_KINDS, ASSET_PROMPT_MAX, generateAssetImage, type AssetKind } from "@plink/ai/assets";
import {
  MAX_IMAGE_BYTES,
  UPLOAD_NOT_CONFIGURED_MESSAGE,
  formatBytes,
  putObject,
  slugifyFilename,
  uploadEnabled,
  userPrefix,
} from "@plink/storage";
import { fail, ok, readJson, tooMany } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { logEvent, writeAudit } from "@/lib/site-store";
import { requireSite } from "@/lib/workspace";
import { storeErrorResponse } from "../sites/store-errors";

/**
 * The AI asset library (Feature G — docs/specs/asset-generator/spec.md).
 *
 * This route is the only place the three integrations meet: `@plink/ai`
 * produces bytes, `@plink/storage` writes them, prisma records the row. Keeping
 * the seam here is what lets `@plink/ai` stay free of storage and stay unit
 * testable (constitution V.1).
 *
 * Ownership is `requireSite` and nothing else: a caller who does not own the
 * site cannot generate into it, cannot read its library, and cannot tell the
 * difference between "not yours" and "does not exist".
 */

/** Image bytes go out through a Node function, and a generation can take ~30s. */
export const runtime = "nodejs";
export const maxDuration = 60;

const generateSchema = z.object({
  siteId: z.string().min(1).max(64),
  kind: z.enum(ASSET_KINDS),
  prompt: z.string().trim().min(1).max(ASSET_PROMPT_MAX),
});

/** File extension for a validated media type — the allowlist is the generator's. */
const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * The site id is the one key segment `@plink/storage` does not scrub for us
 * (its helpers cover the owner prefix and the leaf), so it gets the same
 * treatment the storage package gives a user id: alphanumerics, dash and
 * underscore only. Combined with `userPrefix` and `slugifyFilename`, no part
 * of the key can escape the caller's own prefix (constitution I.4).
 */
function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "site";
}

type AssetRow = {
  id: string;
  kind: string;
  url: string;
  mimeType: string;
  prompt: string;
  meta: string;
  createdAt: Date;
};

/** `meta` is a JSON string column; a row written by anything else still lists. */
function assetKindFrom(meta: string): AssetKind {
  try {
    const parsed: unknown = JSON.parse(meta || "{}");
    const value = (parsed as { assetKind?: unknown } | null)?.assetKind;
    return ASSET_KINDS.includes(value as AssetKind) ? (value as AssetKind) : "hero";
  } catch {
    return "hero";
  }
}

function serialize(row: AssetRow) {
  return {
    id: row.id,
    kind: row.kind,
    assetKind: assetKindFrom(row.meta),
    url: row.url,
    mimeType: row.mimeType,
    prompt: row.prompt,
    createdAt: row.createdAt.toISOString(),
  };
}

const SELECT = {
  id: true,
  kind: true,
  url: true,
  mimeType: true,
  prompt: true,
  meta: true,
  createdAt: true,
} as const;

/* ------------------------------------------------------------------ POST */

export async function POST(req: NextRequest) {
  const ipLimit = rateLimit(clientKey(req, "assets"), 12, 10 * 60_000);
  if (!ipLimit.ok) return tooMany(ipLimit.retryAfter);

  const parsed = generateSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return fail("Pick a kind and describe the image you want", 422);
  }
  const { siteId, kind, prompt } = parsed.data;

  let userId: string;
  let id: string;
  try {
    const context = await requireSite(siteId);
    userId = context.userId;
    id = context.site.id;
  } catch (error) {
    return storeErrorResponse(error);
  }

  // Two windows, as on /api/upload: one per IP to blunt bursts before the
  // session is touched, one per account because every generation costs money.
  const userLimit = rateLimit(`assets:user:${userId}`, 20, 60 * 60_000);
  if (!userLimit.ok) return tooMany(userLimit.retryAfter);

  if (!aiEnabled()) {
    return fail(
      "AI isn’t configured. Add an AI_GATEWAY_API_KEY to .env.local and restart the server.",
      503,
    );
  }
  // Checked before the model call, not after — a generation we cannot store is
  // money spent for nothing.
  if (!uploadEnabled()) return fail(UPLOAD_NOT_CONFIGURED_MESSAGE, 503);

  let bytes: Uint8Array;
  let mimeType: string;
  try {
    const generated = await generateAssetImage({ kind, prompt });
    bytes = generated.bytes;
    mimeType = generated.mimeType;
  } catch (error) {
    // The generator's messages are written for an operator and carry no key
    // material, so they are safe to pass straight through.
    const message = error instanceof Error ? error.message : "Image generation failed";
    console.error("[assets] generation failed:", message);
    return fail(message, 502);
  }

  const extension = EXTENSIONS[mimeType];
  if (!extension) return fail(`${mimeType} images aren’t supported`, 502);
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return fail(
      `That image is ${formatBytes(bytes.byteLength)}. The limit is ${formatBytes(MAX_IMAGE_BYTES)}.`,
      502,
    );
  }

  const pathname = `${userPrefix(userId)}/ai-asset/${safeSegment(id)}/${slugifyFilename(`${kind}.${extension}`)}`;

  let url: string;
  try {
    const stored = await putObject({
      pathname,
      // The SDK types its bytes over `ArrayBufferLike`, which `Blob` will not
      // take. Copying into a plain buffer satisfies the type and hands the
      // store memory nothing else holds a view onto.
      body: new Blob([new Uint8Array(bytes)], { type: mimeType }),
      contentType: mimeType,
    });
    url = stored.url;
  } catch (error) {
    // Message only — a Blob SDK error never carries the token.
    console.error("[assets] put failed:", error instanceof Error ? error.message : "unknown error");
    return fail("The image was generated but couldn’t be stored. Please try again.", 502);
  }

  const asset = await prisma.asset.create({
    data: {
      userId,
      siteId: id,
      kind: "ai",
      url,
      mimeType,
      prompt,
      meta: JSON.stringify({ assetKind: kind }),
    },
    select: SELECT,
  });

  await writeAudit({
    userId,
    siteId: id,
    action: "asset.generate",
    after: JSON.stringify({ assetId: asset.id, assetKind: kind, mimeType }),
  });
  await logEvent({
    userId,
    siteId: id,
    type: "asset_generated",
    data: { assetId: asset.id, assetKind: kind },
  });

  return ok({ asset: serialize(asset) });
}

/* ------------------------------------------------------------------- GET */

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get("siteId") ?? "";
  if (!siteId) return fail("Tell us which site's assets to list", 422);

  let id: string;
  try {
    id = (await requireSite(siteId)).site.id;
  } catch (error) {
    return storeErrorResponse(error);
  }

  const rows = await prisma.asset.findMany({
    where: { siteId: id },
    orderBy: { createdAt: "desc" },
    select: SELECT,
  });

  return ok({ assets: rows.map(serialize) });
}
