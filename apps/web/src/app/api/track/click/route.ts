import type { NextRequest } from "next/server";
import { prisma } from "@plink/db";
import { deviceFrom, readJson, referrerFrom } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";

type Payload = { userId?: string; blockId?: string };

export async function POST(req: NextRequest) {
  // Tracking must never break a visitor's navigation: always answer 204.
  const limit = rateLimit(clientKey(req, "track-click"), 120, 60_000);
  if (!limit.ok) return new Response(null, { status: 204 });

  const body = await readJson<Payload>(req);
  if (!body?.userId) return new Response(null, { status: 204 });

  try {
    const block = body.blockId
      ? await prisma.block.findUnique({ where: { id: body.blockId }, select: { id: true, userId: true } })
      : null;
    if (block && block.userId !== body.userId) return new Response(null, { status: 204 });

    await prisma.$transaction([
      prisma.clickEvent.create({
        data: {
          userId: body.userId,
          blockId: block?.id ?? null,
          referrer: referrerFrom(req.headers.get("referer")),
          device: deviceFrom(req.headers.get("user-agent")),
        },
      }),
      ...(block ? [prisma.block.update({ where: { id: block.id }, data: { clicks: { increment: 1 } } })] : []),
    ]);
  } catch {
    /* analytics is best-effort */
  }

  return new Response(null, { status: 204 });
}
