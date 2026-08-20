import type { NextRequest } from "next/server";
import { prisma } from "@plink/db";
import { ok, tooMany } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { isReservedUsername, slugifyUsername } from "@plink/core/utils";
import { DEMO_BY_USERNAME } from "@plink/core/demo-profiles";

export async function GET(req: NextRequest) {
  const limit = rateLimit(clientKey(req, "username-check"), 60, 60_000);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const raw = req.nextUrl.searchParams.get("u") ?? "";
  const username = slugifyUsername(raw);

  if (username.length < 3) {
    return ok({ available: false, reason: "At least 3 characters" });
  }

  // A real account wins over a built-in demo handle, so check the database
  // first and only report "reserved" for names nobody has actually claimed.
  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (existing) {
    return ok({ available: false, username, reason: "Already taken" });
  }

  if (isReservedUsername(username) || DEMO_BY_USERNAME.has(username)) {
    return ok({ available: false, username, reason: "That name is reserved" });
  }

  return ok({ available: true, username });
}
