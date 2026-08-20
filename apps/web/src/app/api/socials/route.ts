import { prisma } from "@plink/db";
import { getSessionUserId } from "@/lib/auth";
import { fail, ok } from "@/lib/http";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return fail("Not signed in", 401);

  const socials = await prisma.socialLink.findMany({
    where: { userId },
    orderBy: { position: "asc" },
    select: { id: true, platform: true, url: true },
  });

  return ok({ socials });
}
