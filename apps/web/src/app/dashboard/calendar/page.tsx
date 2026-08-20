import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@plink/db";
import { CalendarView } from "./_components/calendar-view";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const [user, availability, bookings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { username: true } }),
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
  if (!user) redirect("/login");

  return (
    <CalendarView
      username={user.username}
      now={new Date().toISOString()}
      timezone={availability[0]?.timezone ?? "UTC"}
      slotMins={availability[0]?.slotMins ?? 30}
      availability={availability.map((row) => ({
        id: row.id,
        weekday: row.weekday,
        startMin: row.startMin,
        endMin: row.endMin,
      }))}
      bookings={bookings.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        note: row.note,
        start: row.startsAt.toISOString(),
        end: row.endsAt.toISOString(),
        status: row.status,
        timezone: row.timezone,
      }))}
    />
  );
}
