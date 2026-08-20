import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { deviceFrom, readJson, referrerFrom } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limit = rateLimit(clientKey(req, "track-view"), 90, 60_000);
  if (!limit.ok) return new Response(null, { status: 204 });

  const body = await readJson<{ userId?: string; referrer?: string }>(req);
  if (!body?.userId) return new Response(null, { status: 204 });

  try {
    await prisma.pageView.create({
      data: {
        userId: body.userId,
        referrer: body.referrer ? referrerFrom(body.referrer) : referrerFrom(req.headers.get("referer")),
        device: deviceFrom(req.headers.get("user-agent")),
      },
    });
  } catch {
    /* best effort */
  }
  return new Response(null, { status: 204 });
}
