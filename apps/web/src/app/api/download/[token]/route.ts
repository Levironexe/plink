import { NextResponse } from "next/server";
import { prisma } from "@plink/db";
import { fail } from "@/lib/http";
import { absoluteUrl } from "@plink/payments";
import { safeUrl } from "@plink/core/utils";

/**
 * Redeems the download grant minted by the webhook. The token is the only thing
 * a buyer holds, so an unknown or unpaid one is indistinguishable from a 404.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) return fail("This download link is no longer valid", 404);

  const order = await prisma.order.findUnique({
    where: { downloadToken: token },
    select: { status: true, product: { select: { fileUrl: true } } },
  });

  const fileUrl = order?.product?.fileUrl;
  if (!order || order.status !== "paid" || !fileUrl) {
    return fail("This download link is no longer valid", 404);
  }

  const target = fileUrl.startsWith("/") ? absoluteUrl(fileUrl) : safeUrl(fileUrl);
  if (!/^https?:\/\//i.test(target)) return fail("This download link is no longer valid", 404);

  const res = NextResponse.redirect(target, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
