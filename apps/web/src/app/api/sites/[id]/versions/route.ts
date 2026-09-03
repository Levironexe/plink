import type { NextRequest } from "next/server";
import { ok } from "@/lib/http";
import { listVersions } from "@/lib/site-store";
import { storeErrorResponse } from "../../store-errors";

/** Version history for the studio's publish/rollback panel, newest first. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    return ok({ versions: await listVersions(id) });
  } catch (error) {
    return storeErrorResponse(error);
  }
}
