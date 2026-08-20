import type { NextRequest } from "next/server";
import { prisma } from "@plink/db";
import { fail, ok, tooMany } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { dateKeyInZone, dayBoundsInZone, slotsFor } from "@plink/core/scheduling";

const DAY_MS = 24 * 60 * 60_000;

/**
 * GET /api/bookings/slots?username=mia&date=2026-09-07
 *
 * The bookable slots left on one calendar day, read in the creator's own
 * timezone. `weekdays` lists the days of the week the creator works at all, so
 * the widget can grey out closed dates without a request per day.
 */
export async function GET(req: NextRequest) {
  const limit = rateLimit(clientKey(req, "slots"), 90, 60_000);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const url = new URL(req.url);
  const username = (url.searchParams.get("username") ?? "").trim().toLowerCase();
  if (!username) return fail("A username is required", 422);

  const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (!user) return fail("Page not found", 404);

  const availability = await prisma.availability.findMany({
    where: { userId: user.id },
    orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
  });

  const timezone = availability[0]?.timezone ?? "UTC";
  const date = (url.searchParams.get("date") ?? "").trim() || dateKeyInZone(new Date(), timezone);
  const weekdays = [...new Set(availability.map((a) => a.weekday))].sort();
  const slotMins = availability[0]?.slotMins ?? 30;

  if (availability.length === 0) {
    return ok({ date, timezone, slotMins, weekdays, slots: [] });
  }

  const bounds = dayBoundsInZone(date, timezone);
  if (!bounds) return fail("Use a YYYY-MM-DD date", 422);

  // Widened by a day on each side so a booking made in another zone — or one
  // that straddles midnight — still shows up as a conflict.
  const bookings = await prisma.booking.findMany({
    where: {
      userId: user.id,
      status: "confirmed",
      startsAt: { lt: new Date(bounds.end.getTime() + DAY_MS) },
      endsAt: { gt: new Date(bounds.start.getTime() - DAY_MS) },
    },
    select: { startsAt: true, endsAt: true, status: true },
  });

  const slots = slotsFor({ availability, bookings, date, now: new Date() });

  return ok({
    date,
    timezone,
    slotMins,
    weekdays,
    slots: slots.map((slot) => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      label: slot.label,
    })),
  });
}
