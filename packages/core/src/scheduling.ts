/**
 * Scheduling — the pure logic behind timed blocks and calendar booking.
 *
 * Nothing in here reads the database, the network or the clock: every function
 * takes the current time as an argument, so all of it is directly testable.
 *
 * ## Timezone / DST approach
 *
 * `Availability` stores wall-clock minutes (`startMin`/`endMin`) against an
 * IANA zone. Turning "09:00 on 2026-03-08 in America/New_York" into a real
 * instant is the only hard part, and it has to survive DST transitions.
 *
 * We do it without a date library:
 *   1. Pretend the wall clock is UTC — that gives a candidate instant.
 *   2. Ask `Intl.DateTimeFormat` what that instant looks like in the target
 *      zone, and diff the two to recover the zone's offset *at that instant*.
 *   3. Subtract the offset, then re-measure once. If the offset changed (the
 *      candidate landed on the far side of a transition) we use the corrected
 *      one. A single refinement is enough because real-world offsets move by at
 *      most a couple of hours.
 *
 * Because the offset is sampled per slot rather than per day, a window that
 * straddles a transition still produces the right instants: on a spring-forward
 * day 01:30 and 03:30 map to consecutive instants, and the skipped 02:30 folds
 * onto the same instant as another slot — deduplication by instant then drops
 * it. On a fall-back day the repeated hour collapses to the earlier instant for
 * the same reason, so we never offer the same moment twice.
 */

export type SchedulableBlock = {
  visible: boolean;
  /** Open bound when null/undefined — the block has no start date. */
  startsAt?: Date | string | number | null;
  /** Open bound when null/undefined — the block never expires. */
  endsAt?: Date | string | number | null;
};

export type AvailabilityWindow = {
  /** 0 = Sunday … 6 = Saturday, in `timezone`. */
  weekday: number;
  /** Minutes from midnight, wall clock in `timezone`. */
  startMin: number;
  endMin: number;
  timezone: string;
  /** Length of one bookable slot, in minutes. */
  slotMins: number;
};

export type BookedRange = {
  startsAt: Date | string | number;
  endsAt: Date | string | number;
  /** Anything other than "confirmed" is ignored — cancelled slots free up. */
  status?: string;
};

export type Slot = {
  /** Instant the slot begins. */
  start: Date;
  /** Instant the slot ends. */
  end: Date;
  /** Wall-clock label in the creator's zone, e.g. "9:30 AM". */
  label: string;
  timezone: string;
};

export type SlotsInput = {
  availability: AvailabilityWindow[];
  bookings?: BookedRange[];
  /** The calendar day to expand — "YYYY-MM-DD", or a Date read in `timezone`. */
  date: string | Date;
  /** Overrides every window's own zone. Defaults to the window's `timezone`. */
  timezone?: string;
  /** Slots starting at or before this instant are dropped. */
  now?: Date;
};

export const MINUTES_PER_DAY = 1440;

/* ------------------------------------------------------------------ blocks */

function toTime(value: Date | string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * The scheduling predicate. A block shows on the public page when it is marked
 * visible *and* `now` sits inside its window. Either bound may be null, which
 * leaves that side of the window open, so an unscheduled visible block is
 * always live. Both bounds are inclusive: a block is live at the exact instant
 * it starts and at the exact instant it ends.
 */
export function isBlockLive(block: SchedulableBlock, now: Date = new Date()): boolean {
  if (!block.visible) return false;

  const at = now.getTime();
  const start = toTime(block.startsAt);
  const end = toTime(block.endsAt);

  if (start !== null && at < start) return false;
  if (end !== null && at > end) return false;
  return true;
}

/** Convenience filter over `isBlockLive` for rendering a public page. */
export function liveBlocks<T extends SchedulableBlock>(blocks: T[], now: Date = new Date()): T[] {
  return blocks.filter((block) => isBlockLive(block, now));
}

export type ScheduleState = "hidden" | "always" | "scheduled" | "live" | "expired";

/** Which side of its window a block currently sits on. */
export function scheduleState(block: SchedulableBlock, now: Date = new Date()): ScheduleState {
  if (!block.visible) return "hidden";

  const at = now.getTime();
  const start = toTime(block.startsAt);
  const end = toTime(block.endsAt);

  if (start === null && end === null) return "always";
  if (start !== null && at < start) return "scheduled";
  if (end !== null && at > end) return "expired";
  return "live";
}

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * "3 Sep", or "3 Sep 2027" once the date leaves the current year. Built by hand
 * rather than through `toLocaleDateString` so the label cannot drift with the
 * host's ICU data ("Sept" vs "Sep") or locale.
 */
function shortDate(time: number, now: Date, timeZone?: string): string {
  const zone = timeZone ?? systemTimeZone();
  const date = calendarInZone(new Date(time), zone);
  const today = calendarInZone(now, zone);

  const month = SHORT_MONTHS[date.month - 1] ?? "";
  return date.year === today.year
    ? `${date.day} ${month}`
    : `${date.day} ${month} ${date.year}`;
}

/**
 * A short label for the editor, e.g. "Live until 3 Sep" or "Scheduled for
 * 1 Sep". Pass `timeZone` to format in a fixed zone (tests use "UTC");
 * otherwise dates render in the viewer's own zone.
 */
export function describeSchedule(
  block: SchedulableBlock,
  now: Date = new Date(),
  timeZone?: string,
): string {
  const start = toTime(block.startsAt);
  const end = toTime(block.endsAt);

  switch (scheduleState(block, now)) {
    case "hidden":
      return "Hidden";
    case "scheduled":
      return `Scheduled for ${shortDate(start as number, now, timeZone)}`;
    case "expired":
      return `Ended ${shortDate(end as number, now, timeZone)}`;
    case "live":
      if (end !== null) return `Live until ${shortDate(end, now, timeZone)}`;
      if (start !== null) return `Live since ${shortDate(start, now, timeZone)}`;
      return "Live";
    default:
      return "Live";
  }
}

/* --------------------------------------------------------------- timezones */

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

function offsetFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = offsetFormatters.get(timeZone);
  if (cached) return cached;

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    // An unknown zone should degrade to UTC rather than take the page down.
    formatter = offsetFormatter("UTC");
  }
  offsetFormatters.set(timeZone, formatter);
  return formatter;
}

/** The zone's UTC offset, in milliseconds, at a given instant. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = offsetFormatter(timeZone).formatToParts(new Date(instant));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );
  return asUtc - instant;
}

/**
 * Resolve a wall-clock time in a zone to a real instant. `minutes` counts from
 * midnight and may exceed 1440, which rolls into the next day.
 */
export function zonedWallClockToUtc(
  year: number,
  month: number,
  day: number,
  minutes: number,
  timeZone: string,
): Date {
  const wall = Date.UTC(year, month - 1, day, 0, minutes, 0, 0);
  const first = zoneOffsetMs(wall, timeZone);
  let instant = wall - first;

  const second = zoneOffsetMs(instant, timeZone);
  if (second !== first) instant = wall - second;

  return new Date(instant);
}

function systemTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Year / month / day as they read on the wall in `timeZone`. */
function calendarInZone(instant: Date, timeZone: string): { year: number; month: number; day: number } {
  const parts = offsetFormatter(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return { year: read("year"), month: read("month"), day: read("day") };
}

/** The calendar day an instant falls on, as "YYYY-MM-DD" in `timeZone`. */
export function dateKeyInZone(instant: Date, timeZone: string): string {
  const parts = offsetFormatter(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateKey(key: string): { year: number; month: number; day: number } | null {
  const match = DATE_KEY.exec(key.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Reject dates that rolled over, e.g. "2026-02-31".
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;

  return { year, month, day };
}

const labelFormatters = new Map<string, Intl.DateTimeFormat>();

function slotLabel(instant: Date, timeZone: string): string {
  let formatter = labelFormatters.get(timeZone);
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
    labelFormatters.set(timeZone, formatter);
  }
  // Recent ICU separates the meridiem with U+202F; normalise it so labels and
  // snapshots stay plain ASCII.
  return formatter.format(instant).replace(/[\u202f\u00a0]/g, " ");
}

/* ------------------------------------------------------------------- slots */

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Expand weekly availability into the concrete slots bookable on one day.
 *
 * Slots that overlap a confirmed booking are removed, as are slots that start
 * at or before `now` — nobody can book the past. The result is sorted and free
 * of duplicates, so overlapping availability windows are safe.
 */
export function slotsFor(input: SlotsInput): Slot[] {
  const { availability, bookings = [], timezone, now = new Date() } = input;
  if (availability.length === 0) return [];

  const defaultZone = timezone ?? availability[0]?.timezone ?? "UTC";
  const key =
    typeof input.date === "string" ? input.date : dateKeyInZone(input.date, defaultZone);

  const calendar = parseDateKey(key);
  if (!calendar) return [];

  const { year, month, day } = calendar;
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  const booked = bookings
    .filter((b) => (b.status ?? "confirmed") === "confirmed")
    .map((b) => ({ start: toDate(b.startsAt).getTime(), end: toDate(b.endsAt).getTime() }))
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end));

  const nowMs = now.getTime();
  const byStart = new Map<number, Slot>();

  for (const window of availability) {
    if (window.weekday !== weekday) continue;

    const zone = timezone ?? window.timezone ?? "UTC";
    const slotMins = Math.floor(window.slotMins);
    if (!Number.isFinite(slotMins) || slotMins <= 0) continue;

    const startMin = Math.max(0, Math.floor(window.startMin));
    const endMin = Math.min(MINUTES_PER_DAY, Math.floor(window.endMin));
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) continue;

    for (let minute = startMin; minute + slotMins <= endMin; minute += slotMins) {
      const start = zonedWallClockToUtc(year, month, day, minute, zone);
      // The end is elapsed time from the start, not the wall clock `slotMins`
      // later: a 30 minute call is 30 real minutes even across a DST jump.
      const end = new Date(start.getTime() + slotMins * 60_000);

      const startMs = start.getTime();
      if (startMs <= nowMs) continue;
      if (byStart.has(startMs)) continue;

      const endMs = end.getTime();
      const clash = booked.some((b) => startMs < b.end && endMs > b.start);
      if (clash) continue;

      byStart.set(startMs, { start, end, label: slotLabel(start, zone), timezone: zone });
    }
  }

  return [...byStart.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * The UTC instants bounding a calendar day in a zone — handy for scoping the
 * booking query that feeds `slotsFor`.
 */
export function dayBoundsInZone(
  date: string,
  timeZone: string,
): { start: Date; end: Date } | null {
  const calendar = parseDateKey(date);
  if (!calendar) return null;

  const { year, month, day } = calendar;
  return {
    start: zonedWallClockToUtc(year, month, day, 0, timeZone),
    end: zonedWallClockToUtc(year, month, day, MINUTES_PER_DAY, timeZone),
  };
}

/** "YYYY-MM-DD" keys for `count` consecutive days starting at `from`. */
export function upcomingDateKeys(from: Date, count: number, timeZone: string): string[] {
  const keys: string[] = [];
  const first = parseDateKey(dateKeyInZone(from, timeZone));
  if (!first) return keys;

  for (let i = 0; i < count; i++) {
    const day = new Date(Date.UTC(first.year, first.month - 1, first.day + i));
    keys.push(day.toISOString().slice(0, 10));
  }
  return keys;
}

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** "09:30" from minutes-since-midnight — the value an <input type="time"> wants. */
export function minutesToTimeValue(minutes: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY, Math.floor(minutes)));
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** Inverse of `minutesToTimeValue`; returns null for anything unparseable. */
export function timeValueToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 24 || mins > 59) return null;

  const total = hours * 60 + mins;
  return total > MINUTES_PER_DAY ? null : total;
}
