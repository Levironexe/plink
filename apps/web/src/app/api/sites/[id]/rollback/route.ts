import type { NextRequest } from "next/server";
import { fail, ok, readJson } from "@/lib/http";
import { rollbackSite } from "@/lib/site-store";
import { storeErrorResponse } from "../../store-errors";

/**
 * Restores an earlier version by publishing its snapshot as a NEW version —
 * history is never rewritten. Body: `{ number }`.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const body = await readJson<{ number?: unknown }>(req);
  const number = body?.number;
  if (typeof number !== "number" || !Number.isInteger(number) || number < 1) {
    return fail("Provide the version number to roll back to", 400);
  }

  try {
    const result = await rollbackSite(id, number);
    if (!result.ok) return fail(result.error, 400);
    return ok({ versionNumber: result.versionNumber });
  } catch (error) {
    return storeErrorResponse(error);
  }
}
