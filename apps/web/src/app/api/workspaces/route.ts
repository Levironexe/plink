import { prisma } from "@plink/db";
import { getSessionUserId } from "@/lib/auth";
import { fail, ok } from "@/lib/http";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return fail("Not signed in", 401);

  const workspaces = await prisma.workspace.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      sites: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, slug: true, template: true, status: true },
      },
    },
  });

  return ok({ workspaces });
}
