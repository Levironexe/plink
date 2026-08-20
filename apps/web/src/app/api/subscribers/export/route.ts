import { prisma } from "@plink/db";
import { getCurrentUser } from "@/lib/auth";
import { fail } from "@/lib/http";

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in", 401);

  const subscribers = await prisma.subscriber.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const rows = [
    ["email", "name", "source", "subscribed_at"].join(","),
    ...subscribers.map((s) =>
      [csvCell(s.email), csvCell(s.name), csvCell(s.source), csvCell(s.createdAt.toISOString())].join(","),
    ),
  ].join("\n");

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(rows, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="plink-${user.username}-subscribers-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
