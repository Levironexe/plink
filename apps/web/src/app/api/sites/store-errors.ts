import { fail } from "@/lib/http";

/**
 * Maps the site-store's thrown access errors onto HTTP responses. Domain
 * failures (`{ ok: false }` results) are the routes' own concern — they
 * become 400s with the store's message.
 */
export function storeErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "UNAUTHENTICATED") return fail("Not signed in", 401);
  if (message === "FORBIDDEN") return fail("You don’t have access to that site", 403);
  if (message === "NOT_FOUND") return fail("Site not found", 404);
  return fail("Something went wrong", 500);
}
