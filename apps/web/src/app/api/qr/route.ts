import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@plink/db";
import { fail, tooMany } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { clampQrSize, qrPngBuffer, qrSvgString } from "@/lib/qr";
import { publicPageUrl } from "@plink/core/domains";
import { DEMO_BY_USERNAME } from "@plink/core/demo-profiles";

/**
 * GET /api/qr?username=mia&format=png|svg&size=512[&download=1]
 *
 * Renders a QR code for a creator's public page. The payload is derived
 * entirely from the query, so the response is safe to cache hard and is tagged
 * with an ETag covering the encoded URL.
 */
export async function GET(req: NextRequest) {
  const limit = rateLimit(clientKey(req, "qr"), 60, 60_000);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const url = new URL(req.url);
  const username = (url.searchParams.get("username") ?? "").trim().toLowerCase();
  if (!username) return fail("A username is required", 422);

  const format = url.searchParams.get("format") === "svg" ? "svg" : "png";
  const size = clampQrSize(url.searchParams.get("size"));
  const download = url.searchParams.get("download") === "1";

  const user = await prisma.user.findUnique({
    where: { username },
    select: { username: true, customDomain: true, domainVerifiedAt: true },
  });

  // Demo pages are real public URLs even though they have no row.
  const target =
    user ??
    (DEMO_BY_USERNAME.has(username)
      ? { username, customDomain: null, domainVerifiedAt: null }
      : null);
  if (!target) return fail("Page not found", 404);

  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  const pageUrl = publicPageUrl(target, origin);

  const etag = `"${createHash("sha1").update(`${pageUrl}|${format}|${size}`).digest("hex")}"`;
  const cacheControl = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800";

  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": cacheControl } });
  }

  const disposition = `${download ? "attachment" : "inline"}; filename="${username}-plink-qr.${format}"`;

  if (format === "svg") {
    const svg = await qrSvgString(pageUrl, { size });
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": cacheControl,
        "Content-Disposition": disposition,
        ETag: etag,
      },
    });
  }

  const png = await qrPngBuffer(pageUrl, { size });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": cacheControl,
      "Content-Disposition": disposition,
      ETag: etag,
    },
  });
}
