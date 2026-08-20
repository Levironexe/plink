import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@plink/db";
import { consumeVerificationToken } from "@plink/email/tokens";

/**
 * The destination of the link in the confirmation email. It is a GET because a
 * mail client can only ever issue one, so the outcome is always a redirect
 * back into the app with a flag the dashboard can read.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const to = (path: string) => NextResponse.redirect(new URL(path, req.nextUrl.origin));

  const claim = await consumeVerificationToken(token, "verify_email");
  if (!claim.ok) return to(`/dashboard?verified=0&reason=${claim.reason}`);

  await prisma.user.update({
    where: { id: claim.userId },
    data: { emailVerified: new Date() },
  });

  return to("/dashboard?verified=1");
}
