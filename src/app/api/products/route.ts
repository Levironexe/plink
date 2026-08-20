import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { fail, ok } from "@/lib/http";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return fail("Not signed in", 401);

  const products = await prisma.product.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, priceCents: true, currency: true, published: true },
  });

  return ok({ products });
}
