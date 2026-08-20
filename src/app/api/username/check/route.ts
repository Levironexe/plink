import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, tooMany } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { isReservedUsername, slugifyUsername } from "@/lib/utils";
import { DEMO_BY_USERNAME } from "@/lib/demo-profiles";

export async function GET(req: NextRequest) {
  const limit = rateLimit(clientKey(req, "username-check"), 60, 60_000);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const raw = req.nextUrl.searchParams.get("u") ?? "";
  const username = slugifyUsername(raw);

  if (username.length < 3) {
    return ok({ available: false, reason: "At least 3 characters" });
  }
  if (isReservedUsername(username) || DEMO_BY_USERNAME.has(username)) {
    return ok({ available: false, reason: "That name is reserved" });
  }

  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  return ok({
    available: !existing,
    username,
    reason: existing ? "Already taken" : undefined,
  });
}
