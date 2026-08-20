"use client";

import * as React from "react";
import { CalendarDays, CalendarX, Clock, Globe, Mail, Trash2 } from "lucide-react";
import { Button } from "@plink/ui/button";
import { Toggle } from "@plink/ui/field";
import { useToast } from "@plink/ui/toast";
import { EmptyState, PageHeader } from "../../_components/page-header";
import {
  WEEKDAY_LABELS,
  minutesToTimeValue,
  timeValueToMinutes,
} from "@plink/core/scheduling";
import { cn } from "@plink/core/utils";

export type AvailabilityRow = {
  id: string;
  weekday: number;
  startMin: number;
  endMin: number;
};

export type BookingRow = {
  id: string;
  name: string;
  email: string;
  note: string;
  /** ISO instant. */
  start: string;
  end: string;
  status: string;
  timezone: string;
};

type DayState = { open: boolean; startMin: number; endMin: number };

const DEFAULT_DAY: DayState = { open: false, startMin: 9 * 60, endMin: 17 * 60 };

const SLOT_CHOICES = [15, 20, 30, 45, 60, 90] as const;

/** A short, curated list — plus whatever the creator's browser reports. */
const ZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Istanbul",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function buildDays(availability: AvailabilityRow[]): DayState[] {
  return WEEKDAY_LABELS.map((_, weekday) => {
    const row = availability.find((a) => a.weekday === weekday);
    return row
      ? { open: true, startMin: row.startMin, endMin: row.endMin }
      : { ...DEFAULT_DAY };
  });
}

export function CalendarView({
  username,
  timezone: initialTimezone,
  slotMins: initialSlotMins,
  availability,
  bookings: initialBookings,
  now,
}: {
  username: string;
  timezone: string;
  slotMins: number;
  availability: AvailabilityRow[];
  bookings: BookingRow[];
  /** ISO instant used to split upcoming from past — passed in for determinism. */
  now: string;
}) {
  const { toast } = useToast();
  const [days, setDays] = React.useState<DayState[]>(() => buildDays(availability));
  const [timezone, setTimezone] = React.useState(initialTimezone);
  const [slotMins, setSlotMins] = React.useState(initialSlotMins);
  const [saving, setSaving] = React.useState(false);
  const [bookings, setBookings] = React.useState(initialBookings);

  // A creator who has never set hours gets their own zone pre-selected. This
  // runs in a callback after mount, so the server-rendered markup (which only
  // knows the stored zone) still hydrates cleanly.
  const untouched = availability.length === 0;
  React.useEffect(() => {
    if (!untouched) return;
    const timer = setTimeout(() => {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) setTimezone(detected);
    }, 0);
    return () => clearTimeout(timer);
  }, [untouched]);

  const zoneOptions = React.useMemo(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return [...new Set([timezone, detected, ...ZONES].filter(Boolean))];
  }, [timezone]);

  // `now` arrives from the server so both renders split the list identically.
  const nowMs = new Date(now).getTime();
  const upcoming = bookings
    .filter((b) => b.status === "confirmed" && new Date(b.end).getTime() >= nowMs)
    .sort((a, b) => a.start.localeCompare(b.start));
  const past = bookings
    .filter((b) => b.status !== "confirmed" || new Date(b.end).getTime() < nowMs)
    .sort((a, b) => b.start.localeCompare(a.start))
    .slice(0, 20);

  function patchDay(weekday: number, patch: Partial<DayState>) {
    setDays((current) =>
      current.map((day, index) => (index === weekday ? { ...day, ...patch } : day)),
    );
  }

  async function save() {
    const windows = days
      .map((day, weekday) => ({ weekday, startMin: day.startMin, endMin: day.endMin, open: day.open }))
      .filter((day) => day.open && day.endMin > day.startMin)
      .map(({ weekday, startMin, endMin }) => ({ weekday, startMin, endMin }));

    setSaving(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone, slotMins, windows }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        toast(payload?.error ?? "Could not save your hours", "error");
        return;
      }
      toast(windows.length === 0 ? "Bookings paused" : "Availability saved");
    } catch {
      toast("Could not save your hours", "error");
    } finally {
      setSaving(false);
    }
  }

  async function cancel(id: string) {
    const snapshot = bookings;
    setBookings((current) =>
      current.map((b) => (b.id === id ? { ...b, status: "canceled" } : b)),
    );

    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "canceled" }),
      });
      if (!res.ok) {
        setBookings(snapshot);
        toast("Could not cancel that booking", "error");
        return;
      }
      toast("Booking cancelled — the slot is free again");
    } catch {
      setBookings(snapshot);
      toast("Could not cancel that booking", "error");
    }
  }

  const openDays = days.filter((d) => d.open).length;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:py-10">
      <PageHeader
        title="Calendar"
        description="Set the hours you take meetings. Visitors book straight from your page — no back and forth."
        actions={
          <Button onClick={save} loading={saving}>
            Save availability
          </Button>
        }
      />

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[24px] border border-line bg-surface p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-bold text-ink">Weekly hours</h2>
              <p className="mt-0.5 text-[13.5px] text-ink-muted">
                {openDays === 0
                  ? "No days open — your booking block will say you’re unavailable."
                  : `${openDays} day${openDays === 1 ? "" : "s"} a week, in ${slotMins} minute slots.`}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col divide-y divide-line">
            {WEEKDAY_LABELS.map((label, weekday) => {
              const day = days[weekday];
              const invalid = day.open && day.endMin <= day.startMin;
              return (
                <div
                  key={label}
                  className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="w-[140px] shrink-0">
                    <Toggle
                      checked={day.open}
                      onChange={(open) => patchDay(weekday, { open })}
                      label={label}
                    />
                  </div>

                  <div
                    className={cn(
                      "flex items-center gap-2 transition-opacity",
                      day.open ? "opacity-100" : "pointer-events-none opacity-40",
                    )}
                  >
                    <TimeInput
                      value={day.startMin}
                      label={`${label} opens`}
                      onChange={(startMin) => patchDay(weekday, { startMin })}
                    />
                    <span className="text-[13px] text-ink-muted">to</span>
                    <TimeInput
                      value={day.endMin}
                      label={`${label} closes`}
                      onChange={(endMin) => patchDay(weekday, { endMin })}
                    />
                  </div>

                  {invalid && (
                    <span className="text-[12.5px] font-medium text-coral">
                      End has to be after the start
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-5">
          <div className="rounded-[24px] border border-line bg-surface p-5 shadow-soft">
            <h2 className="text-[17px] font-bold text-ink">Slot settings</h2>

            <label className="field-label mt-4" htmlFor="calendar-timezone">
              <span className="inline-flex items-center gap-1.5">
                <Globe className="size-3.5" aria-hidden /> Timezone
              </span>
            </label>
            <select
              id="calendar-timezone"
              className="field"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {zoneOptions.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>

            <label className="field-label mt-4" htmlFor="calendar-slot">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" aria-hidden /> Meeting length
              </span>
            </label>
            <select
              id="calendar-slot"
              className="field"
              value={slotMins}
              onChange={(e) => setSlotMins(Number(e.target.value))}
            >
              {SLOT_CHOICES.map((value) => (
                <option key={value} value={value}>
                  {value} minutes
                </option>
              ))}
            </select>

            <p className="mt-4 text-[12.5px] text-ink-muted">
              Hours are wall-clock in the zone above, so they follow daylight saving on their own.
            </p>
          </div>

          <div className="rounded-[24px] border border-line bg-canvas p-5">
            <p className="eyebrow">BOOKING LINK</p>
            <p className="mt-1.5 text-[13.5px] break-all text-ink-soft">
              plink.to/{username}
            </p>
            <p className="mt-2 text-[12.5px] text-ink-muted">
              Add a Booking block to your page to show these times.
            </p>
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-[24px] border border-line bg-surface shadow-soft">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-[17px] font-bold text-ink">Upcoming bookings</h2>
          <span className="text-[13px] font-semibold text-ink-muted">{upcoming.length}</span>
        </div>

        {upcoming.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={CalendarDays}
              title="No bookings yet"
              body="Once someone picks a time from your page it lands here, with their note and email."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {upcoming.map((booking) => (
              <li key={booking.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-canvas text-center">
                  <span className="text-[10px] font-bold tracking-wide text-ink-muted uppercase">
                    {new Date(booking.start).toLocaleDateString("en-US", { month: "short" })}
                  </span>
                  <span className="-mt-0.5 text-[15px] leading-none font-extrabold text-ink">
                    {new Date(booking.start).toLocaleDateString("en-US", { day: "numeric" })}
                  </span>
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold text-ink">
                    {booking.name}
                    <span className="ml-2 text-[13px] font-normal text-ink-muted">
                      {new Date(booking.start).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {" – "}
                      {new Date(booking.end).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </p>
                  <p className="truncate text-[12.5px] text-ink-muted">
                    <Mail className="mr-1 inline size-3" aria-hidden />
                    {booking.email}
                    {booking.note && ` · ${booking.note}`}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cancel(booking.id)}
                  aria-label={`Cancel booking with ${booking.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-5 rounded-[24px] border border-line bg-surface shadow-soft">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="text-[17px] font-bold text-ink">Past &amp; cancelled</h2>
            <span className="text-[13px] font-semibold text-ink-muted">{past.length}</span>
          </div>
          <ul className="divide-y divide-line">
            {past.map((booking) => (
              <li key={booking.id} className="flex items-center gap-3 px-5 py-3">
                <CalendarX className="size-4 shrink-0 text-ink-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-ink-soft">
                    {booking.name} ·{" "}
                    {new Date(booking.start).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold",
                    booking.status === "canceled"
                      ? "bg-danger-soft text-danger-deep"
                      : "bg-canvas text-ink-muted",
                  )}
                >
                  {booking.status === "canceled" ? "Cancelled" : "Done"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function TimeInput({
  value,
  label,
  onChange,
}: {
  value: number;
  label: string;
  onChange: (minutes: number) => void;
}) {
  return (
    <input
      type="time"
      aria-label={label}
      value={minutesToTimeValue(value)}
      onChange={(e) => {
        const minutes = timeValueToMinutes(e.target.value);
        if (minutes !== null) onChange(minutes);
      }}
      className="field h-9 w-[118px] px-2"
    />
  );
}
