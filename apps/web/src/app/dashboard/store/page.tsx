import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@plink/db";
import { StoreView } from "./_components/store-view";

export const metadata: Metadata = { title: "Store" };

export default async function StorePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [products, orders] = await Promise.all([
    prisma.product.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { product: { select: { name: true } } },
    }),
  ]);

  const totals = await prisma.order.aggregate({
    where: { userId: user.id, status: "paid" },
    _sum: { amountCents: true },
    _count: true,
  });

  return (
    <StoreView
      plan={user.plan}
      revenueCents={totals._sum.amountCents ?? 0}
      orderCount={totals._count}
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
        currency: p.currency,
        imageUrl: p.imageUrl,
        fileUrl: p.fileUrl,
        type: p.type,
        published: p.published,
        sales: p.sales,
        createdAt: p.createdAt.toISOString(),
      }))}
      orders={orders.map((o) => ({
        id: o.id,
        email: o.email,
        amountCents: o.amountCents,
        productName: o.product?.name ?? null,
        createdAt: o.createdAt.toISOString(),
      }))}
    />
  );
}
