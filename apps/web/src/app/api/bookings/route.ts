import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@plink/db";
import { getSessionUserId } from "@/lib/auth";
import { fail, ok, readJson, tooMany } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { dateKeyInZone, slotsFor } from "@plink/core/scheduling";

const bookingSchema = z.object({
  username: z.string().min(1).max(40),
  name: z.string().min(1, "Add your name").max(80),
  email: z.string().email("Enter a valid email"),
  note: z.string().max(600).optional(),
  /** ISO instant of the slot the visitor picked. */
  start: z.string().min(8).max(40),
  /** The visitor's own timezone, stored so the confirmation reads correctly. */
  timezone: z.string().max(64).optional(),
});

class SlotTaken extends Error {}

/**
 * POST /api/bookings — public. Books one slot on a creator's calendar.
 *
 * Availability is re-derived from the creator's own rows rather than trusted
 * from the client, and the overlap check is repeated *inside* the write
 * transaction so two visitors racing for the last slot cannot both win.
 */
export async function POST(req: NextRequest) {
  const limit = rateLimit(clientKey(req, "booking"), 8, 10 * 60_000);
  if (!limit.ok) return tooMany(limit.retryAfter);

  const parsed = bookingSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check your details", 422);
  }

  const { username, name, email, note, start, timezone } = parsed.data;

  const creator = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true },
  });
  if (!creator) return fail("Page not found", 404);

  const startsAt = new Date(start);
  if (Number.isNaN(startsAt.getTime())) return fail("Pick a time", 422);

  const availability = await prisma.availability.findMany({ where: { userId: creator.id } });
  if (availability.length === 0) return fail("This creator is not taking bookings", 409);

  const creatorZone = availability[0]?.timezone ?? "UTC";
  const date = dateKeyInZone(startsAt, creatorZone);

  const sameDay = await prisma.booking.findMany({
    where: {
      userId: creator.id,
      status: "confirmed",
      startsAt: { lt: new Date(startsAt.getTime() + 24 * 60 * 60_000) },
      endsAt: { gt: new Date(startsAt.getTime() - 24 * 60 * 60_000) },
    },
    select: { startsAt: true, endsAt: true, status: true },
  });

  const slot = slotsFor({ availability, bookings: sameDay, date, now: new Date() }).find(
    (candidate) => candidate.start.getTime() === startsAt.getTime(),
  );
  if (!slot) return fail("That time is no longer available", 409);

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const clash = await tx.booking.findFirst({
        where: {
          userId: creator.id,
          status: "confirmed",
          startsAt: { lt: slot.end },
          endsAt: { gt: slot.start },
        },
        select: { id: true },
      });
      if (clash) throw new SlotTaken();

      return tx.booking.create({
        data: {
          userId: creator.id,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          note: note?.trim() ?? "",
          startsAt: slot.start,
          endsAt: slot.end,
          timezone: timezone?.trim() || creatorZone,
        },
        select: { id: true, startsAt: true, endsAt: true },
      });
    });

    return ok({
      ok: true,
      booking: {
        id: booking.id,
        start: booking.startsAt.toISOString(),
        end: booking.endsAt.toISOString(),
        label: slot.label,
      },
    });
  } catch (error) {
    if (error instanceof SlotTaken) {
      return fail("Someone just took that time — pick another", 409);
    }
    throw error;
  }
}

/* ------------------------------------------------------------ creator side */

/** GET /api/bookings — the signed-in creator's availability and bookings. */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return fail("Not signed in", 401);

  const [availability, bookings] = await Promise.all([
    prisma.availability.findMany({
      where: { userId },
      orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
    }),
    prisma.booking.findMany({
      where: { userId },
      orderBy: { startsAt: "asc" },
      take: 200,
    }),
  ]);

  return ok({
    timezone: availability[0]?.timezone ?? "UTC",
    slotMins: availability[0]?.slotMins ?? 30,
    availability: availability.map((row) => ({
      id: row.id,
      weekday: row.weekday,
      startMin: row.startMin,
      endMin: row.endMin,
    })),
    bookings: bookings.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      note: row.note,
      start: row.startsAt.toISOString(),
      end: row.endsAt.toISOString(),
      status: row.status,
      timezone: row.timezone,
    })),
  });
}

const availabilitySchema = z.object({
  timezone: z.string().min(1).max(64),
  slotMins: z.number().int().min(5).max(480),
  windows: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        startMin: z.number().int().min(0).max(1440),
        endMin: z.number().int().min(0).max(1440),
      }),
    )
    .max(21),
});

/** PUT /api/bookings — replace the whole weekly availability grid. */
export async function PUT(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return fail("Not signed in", 401);

  const parsed = availabilitySchema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Check your opening hours", 422);

  const { timezone, slotMins } = parsed.data;
  const windows = parsed.data.windows.filter((w) => w.endMin > w.startMin);

  await prisma.$transaction(async (tx) => {
    await tx.availability.deleteMany({ where: { userId } });
    if (windows.length > 0) {
      await tx.availability.createMany({
        data: windows.map((w) => ({ userId, ...w, timezone, slotMins })),
      });
    }
  });

  return ok({ ok: true, windows: windows.length });
}

const statusSchema = z.object({
  id: z.string().min(1).max(40),
  status: z.enum(["confirmed", "canceled"]),
});

/** PATCH /api/bookings — confirm or cancel one booking. */
export async function PATCH(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return fail("Not signed in", 401);

  const parsed = statusSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Unknown booking", 422);

  const result = await prisma.booking.updateMany({
    where: { id: parsed.data.id, userId },
    data: { status: parsed.data.status },
  });
  if (result.count === 0) return fail("Booking not found", 404);

  return ok({ ok: true, status: parsed.data.status });
}
