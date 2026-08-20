import type { NextRequest } from "next/server";
import { POST as tipCheckout } from "@/app/api/checkout/tip/route";

/**
 * Kept for the public page's existing call site. Tips are real money now, so the
 * work happens in the shared Stripe Checkout handler and the response carries a
 * `url` for the caller to send the visitor to.
 */
export async function POST(req: NextRequest) {
  return tipCheckout(req);
}
