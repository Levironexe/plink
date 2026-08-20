import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { fail, ok, readJson, tooMany } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { AI_LIMITS, aiEnabled } from "@plink/ai";
import { generateCopy } from "@plink/ai/generate";

export const maxDuration = 30;

/** Cheaper and faster than a full page, so the budget is looser — but finite. */
const HOURLY_LIMIT = 30;
const WINDOW_MS = 60 * 60_000;

const schema = z.object({
  /** What the creator does — used when there is no existing bio to rewrite. */
  context: z.string().trim().max(AI_LIMITS.prompt).optional(),
  bio: z.string().trim().max(AI_LIMITS.bio).optional(),
  titles: z.array(z.string().max(AI_LIMITS.title)).max(AI_LIMITS.maxTitles).optional(),
  tone: z.enum(["warm", "direct", "playful", "professional"]).optional(),
});

/**
 * The "improve my copy" affordance: rewrites a bio and a set of block titles.
 * Returns JSON only — nothing is persisted.
 */
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return fail("Not signed in", 401);

  if (!aiEnabled()) {
    return fail("AI is not configured on this server", 503, { code: "ai_disabled" });
  }

  const limit = rateLimit(`ai:bio:${userId}`, HOURLY_LIMIT, WINDOW_MS);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Add a bio or a description first", 422);

  const { context, bio, titles, tone } = parsed.data;
  if (!context && !bio && !titles?.length) {
    return fail("Add a bio or a description first", 422);
  }

  try {
    const copy = await generateCopy({ tone, context, bio, titles });
    if (!copy.bio && copy.titles.length === 0) {
      return fail("Couldn’t improve that. Try adding a little more detail.", 422);
    }

    return ok({ copy, remaining: limit.remaining });
  } catch (error) {
    // Never log the prompt: it carries the creator's own words.
    console.error("[ai/bio] generation failed:", (error as Error)?.name ?? "unknown");
    return fail("The copy assistant is busy right now. Try again in a moment.", 502);
  }
}
