import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { fail, ok, readJson, tooMany } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { AI_LIMITS, aiEnabled } from "@plink/ai";
import { generatePage } from "@plink/ai/generate";

/** Structured generation of a whole page is the slowest call in the app. */
export const maxDuration = 60;

/** Generation costs real money, so the budget is per user and deliberately tight. */
const HOURLY_LIMIT = 10;
const WINDOW_MS = 60 * 60_000;

const schema = z.object({
  prompt: z.string().trim().min(12, "Tell us a bit more").max(AI_LIMITS.prompt),
  socials: z
    .array(z.object({ platform: z.string().max(40), url: z.string().max(300) }))
    .max(12)
    .optional(),
});

/**
 * Generates a page proposal and returns it as JSON. Nothing is written to the
 * database here — the client previews the result and the creator applies it
 * with an explicit action.
 */
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return fail("Not signed in", 401);

  if (!aiEnabled()) {
    return fail("AI is not configured on this server", 503, { code: "ai_disabled" });
  }

  const limit = rateLimit(`ai:page:${userId}`, HOURLY_LIMIT, WINDOW_MS);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Describe your page first", 422);
  }

  const { prompt, socials } = parsed.data;

  try {
    const page = await generatePage({ prompt, socials });
    if (page.blocks.length === 0) {
      return fail("Couldn’t build a page from that. Try describing what you sell.", 422);
    }

    return ok({ page, remaining: limit.remaining });
  } catch (error) {
    // Deliberately coarse: the prompt and the gateway key must never be logged.
    console.error("[ai/page] generation failed:", (error as Error)?.name ?? "unknown");
    return fail("The page builder is busy right now. Try again in a moment.", 502);
  }
}
