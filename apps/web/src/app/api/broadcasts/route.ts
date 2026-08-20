import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@plink/db";
import { getSessionUserId } from "@/lib/auth";
import { fail, ok, readJson, tooMany } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const createSchema = z.object({
  subject: z.string().trim().min(1, "Give your broadcast a subject").max(140, "Subject is too long"),
  body: z.string().trim().min(1, "Write something to send").max(20_000, "That message is too long"),
});

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return fail("Not signed in", 401);

  const broadcasts = await prisma.broadcast.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return ok({ broadcasts });
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return fail("Not signed in", 401);

  const limit = rateLimit(clientKey(req, "broadcast-create"), 30, 60 * 60_000);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const parsed = createSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check your draft", 422, {
      field: parsed.error.issues[0]?.path[0],
    });
  }

  const broadcast = await prisma.broadcast.create({
    data: { userId, subject: parsed.data.subject, body: parsed.data.body },
  });

  return ok({ broadcast }, { status: 201 });
}
