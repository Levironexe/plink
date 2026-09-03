import type { NextRequest } from "next/server";
import { fail, ok, readJson } from "@/lib/http";
import { publishSite } from "@/lib/site-store";
import { storeErrorResponse } from "../../store-errors";

/** Publishes the current draft as a new immutable version. Body: `{ note? }`. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  // A missing or empty body is simply a publish without a note.
  const body = await readJson<{ note?: unknown }>(req);
  if (body?.note !== undefined && typeof body.note !== "string") {
    return fail("The note must be a string", 400);
  }
  const note = typeof body?.note === "string" ? body.note : undefined;
  if (note !== undefined && note.length > 500) {
    return fail("Keep the note under 500 characters", 400);
  }

  try {
    const result = await publishSite(id, note);
    if (!result.ok) return fail(result.error, 400);
    return ok({ versionNumber: result.versionNumber });
  } catch (error) {
    return storeErrorResponse(error);
  }
}
