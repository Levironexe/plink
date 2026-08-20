import "server-only";
import { prisma } from "@/lib/prisma";
import { RANGES, type Range } from "@/lib/analytics-shared";

export { RANGES };
export type { Range };

export function rangeStart(range: Range, createdAt: Date) {
  const def = RANGES.find((r) => r.id === range) ?? RANGES[1];
  if (def.days === null) return createdAt;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (def.days - 1));
  return start < createdAt ? createdAt : start;
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildDays(from: Date, to: Date) {
  const days: string[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= to) {
    days.push(dayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function tally<T extends { createdAt: Date }>(rows: T[], days: string[]) {
  const counts = new Map(days.map((d) => [d, 0]));
  for (const row of rows) {
    const key = dayKey(row.createdAt);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function breakdown(rows: { referrer?: string; device?: string }[], field: "referrer" | "device") {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = (row[field] || "unknown").toString();
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export type AnalyticsSummary = Awaited<ReturnType<typeof loadAnalytics>>;

export async function loadAnalytics(userId: string, range: Range) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });
  const accountStart = user?.createdAt ?? new Date();
  const from = rangeStart(range, accountStart);
  const to = new Date();

  const [views, clicks, blocks, subscriberCount, orders, prevViews, prevClicks] = await Promise.all([
    prisma.pageView.findMany({
      where: { userId, createdAt: { gte: from } },
      select: { createdAt: true, referrer: true, device: true },
      orderBy: { createdAt: "asc" },
      take: 50_000,
    }),
    prisma.clickEvent.findMany({
      where: { userId, createdAt: { gte: from } },
      select: { createdAt: true, referrer: true, device: true, blockId: true },
      orderBy: { createdAt: "asc" },
      take: 50_000,
    }),
    prisma.block.findMany({
      where: { userId },
      select: { id: true, title: true, type: true, url: true, clicks: true, visible: true },
      orderBy: { position: "asc" },
    }),
    prisma.subscriber.count({ where: { userId } }),
    prisma.order.findMany({
      where: { userId, createdAt: { gte: from } },
      select: { amountCents: true, createdAt: true },
    }),
    // Previous equal-length window, for the delta badges.
    (async () => {
      const span = to.getTime() - from.getTime();
      return prisma.pageView.count({
        where: { userId, createdAt: { gte: new Date(from.getTime() - span), lt: from } },
      });
    })(),
    (async () => {
      const span = to.getTime() - from.getTime();
      return prisma.clickEvent.count({
        where: { userId, createdAt: { gte: new Date(from.getTime() - span), lt: from } },
      });
    })(),
  ]);

  const days = buildDays(from, to);
  const viewsByDay = tally(views, days);
  const clicksByDay = tally(clicks, days);

  const series = days.map((day) => ({
    day,
    label: new Date(`${day}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    views: viewsByDay.get(day) ?? 0,
    clicks: clicksByDay.get(day) ?? 0,
  }));

  const clicksByBlock = new Map<string, number>();
  for (const c of clicks) {
    if (!c.blockId) continue;
    clicksByBlock.set(c.blockId, (clicksByBlock.get(c.blockId) ?? 0) + 1);
  }

  const topLinks = blocks
    .map((b) => ({
      id: b.id,
      title: b.title || b.type,
      type: b.type,
      url: b.url,
      visible: b.visible,
      clicks: clicksByBlock.get(b.id) ?? 0,
      allTimeClicks: b.clicks,
    }))
    .filter((b) => b.type !== "divider")
    .sort((a, b) => b.clicks - a.clicks || b.allTimeClicks - a.allTimeClicks);

  const totalViews = views.length;
  const totalClicks = clicks.length;
  const revenueCents = orders.reduce((sum, o) => sum + o.amountCents, 0);

  const pct = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  return {
    range,
    from,
    to,
    series,
    totals: {
      views: totalViews,
      clicks: totalClicks,
      ctr: totalViews === 0 ? 0 : Math.round((totalClicks / totalViews) * 1000) / 10,
      subscribers: subscriberCount,
      revenueCents,
      orders: orders.length,
    },
    deltas: {
      views: pct(totalViews, prevViews),
      clicks: pct(totalClicks, prevClicks),
    },
    topLinks,
    referrers: breakdown(views, "referrer").slice(0, 6),
    devices: breakdown(views, "device"),
    hasData: totalViews + totalClicks > 0,
  };
}
