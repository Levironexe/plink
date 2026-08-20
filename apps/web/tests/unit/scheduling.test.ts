import { describe, expect, it } from "vitest";
import {
  describeSchedule,
  isBlockLive,
  minutesToTimeValue,
  scheduleState,
  slotsFor,
  timeValueToMinutes,
  zonedWallClockToUtc,
  type AvailabilityWindow,
} from "@plink/core/scheduling";

const NOW = new Date("2026-09-01T12:00:00.000Z");

describe("isBlockLive", () => {
  it("hides a block that is not visible, whatever the window says", () => {
    expect(isBlockLive({ visible: false, startsAt: null, endsAt: null }, NOW)).toBe(false);
    expect(
      isBlockLive(
        { visible: false, startsAt: "2026-08-01T00:00:00Z", endsAt: "2026-10-01T00:00:00Z" },
        NOW,
      ),
    ).toBe(false);
  });

  it("shows a visible block with no bounds", () => {
    expect(isBlockLive({ visible: true, startsAt: null, endsAt: null }, NOW)).toBe(true);
    expect(isBlockLive({ visible: true }, NOW)).toBe(true);
  });

  it("treats a null start as an open lower bound", () => {
    expect(isBlockLive({ visible: true, startsAt: null, endsAt: "2026-09-03T00:00:00Z" }, NOW)).toBe(true);
    expect(isBlockLive({ visible: true, startsAt: null, endsAt: "2026-08-30T00:00:00Z" }, NOW)).toBe(false);
  });

  it("treats a null end as an open upper bound", () => {
    expect(isBlockLive({ visible: true, startsAt: "2026-08-30T00:00:00Z", endsAt: null }, NOW)).toBe(true);
    expect(isBlockLive({ visible: true, startsAt: "2026-09-03T00:00:00Z", endsAt: null }, NOW)).toBe(false);
  });

  it("honours both bounds when both are set", () => {
    const block = { visible: true, startsAt: "2026-08-30T00:00:00Z", endsAt: "2026-09-03T00:00:00Z" };
    expect(isBlockLive(block, NOW)).toBe(true);
    expect(isBlockLive(block, new Date("2026-08-29T23:59:59Z"))).toBe(false);
    expect(isBlockLive(block, new Date("2026-09-03T00:00:01Z"))).toBe(false);
  });

  it("is inclusive at both boundaries", () => {
    const start = new Date("2026-09-01T12:00:00.000Z");
    const end = new Date("2026-09-05T12:00:00.000Z");
    const block = { visible: true, startsAt: start, endsAt: end };

    expect(isBlockLive(block, start)).toBe(true);
    expect(isBlockLive(block, end)).toBe(true);
    expect(isBlockLive(block, new Date(start.getTime() - 1))).toBe(false);
    expect(isBlockLive(block, new Date(end.getTime() + 1))).toBe(false);
  });

  it("ignores bounds it cannot parse", () => {
    expect(isBlockLive({ visible: true, startsAt: "not a date", endsAt: null }, NOW)).toBe(true);
  });
});

describe("scheduleState / describeSchedule", () => {
  it("names each state", () => {
    expect(scheduleState({ visible: false }, NOW)).toBe("hidden");
    expect(scheduleState({ visible: true }, NOW)).toBe("always");
    expect(scheduleState({ visible: true, startsAt: "2026-09-05T00:00:00Z" }, NOW)).toBe("scheduled");
    expect(scheduleState({ visible: true, endsAt: "2026-08-05T00:00:00Z" }, NOW)).toBe("expired");
    expect(scheduleState({ visible: true, endsAt: "2026-09-05T00:00:00Z" }, NOW)).toBe("live");
  });

  it("writes a short human label", () => {
    expect(describeSchedule({ visible: true, endsAt: "2026-09-03T09:00:00Z" }, NOW, "UTC")).toBe(
      "Live until 3 Sep",
    );
    expect(describeSchedule({ visible: true, startsAt: "2026-09-01T09:00:00Z" }, NOW, "UTC")).toBe(
      "Live since 1 Sep",
    );
    expect(describeSchedule({ visible: true, startsAt: "2026-09-05T09:00:00Z" }, NOW, "UTC")).toBe(
      "Scheduled for 5 Sep",
    );
    expect(describeSchedule({ visible: true }, NOW, "UTC")).toBe("Live");
    expect(describeSchedule({ visible: false }, NOW, "UTC")).toBe("Hidden");
  });

  it("adds the year once the date leaves the current one", () => {
    expect(describeSchedule({ visible: true, endsAt: "2027-01-04T09:00:00Z" }, NOW, "UTC")).toBe(
      "Live until 4 Jan 2027",
    );
  });
});

/* 2026-09-07 is a Monday; 2026-09-08 a Tuesday. */
const monday: AvailabilityWindow = {
  weekday: 1,
  startMin: 9 * 60,
  endMin: 11 * 60,
  timezone: "UTC",
  slotMins: 30,
};

describe("slotsFor", () => {
  it("expands a weekly window into slots on the matching weekday", () => {
    const slots = slotsFor({
      availability: [monday],
      date: "2026-09-07",
      now: new Date("2026-09-01T00:00:00Z"),
    });

    expect(slots.map((s) => s.start.toISOString())).toEqual([
      "2026-09-07T09:00:00.000Z",
      "2026-09-07T09:30:00.000Z",
      "2026-09-07T10:00:00.000Z",
      "2026-09-07T10:30:00.000Z",
    ]);
    expect(slots[0].end.toISOString()).toBe("2026-09-07T09:30:00.000Z");
    expect(slots[0].label).toBe("9:00 AM");
  });

  it("returns nothing for a weekday with no window", () => {
    expect(
      slotsFor({ availability: [monday], date: "2026-09-08", now: new Date("2026-09-01T00:00:00Z") }),
    ).toEqual([]);
  });

  it("returns nothing when there is no availability at all", () => {
    expect(slotsFor({ availability: [], date: "2026-09-07", now: NOW })).toEqual([]);
  });

  it("drops slots that overlap a confirmed booking", () => {
    const slots = slotsFor({
      availability: [monday],
      bookings: [
        { startsAt: "2026-09-07T09:15:00Z", endsAt: "2026-09-07T09:45:00Z" },
        { startsAt: "2026-09-07T10:30:00Z", endsAt: "2026-09-07T11:00:00Z" },
      ],
      date: "2026-09-07",
      now: new Date("2026-09-01T00:00:00Z"),
    });

    expect(slots.map((s) => s.start.toISOString())).toEqual(["2026-09-07T10:00:00.000Z"]);
  });

  it("frees a slot again once its booking is cancelled", () => {
    const slots = slotsFor({
      availability: [monday],
      bookings: [{ startsAt: "2026-09-07T09:00:00Z", endsAt: "2026-09-07T09:30:00Z", status: "canceled" }],
      date: "2026-09-07",
      now: new Date("2026-09-01T00:00:00Z"),
    });

    expect(slots).toHaveLength(4);
  });

  it("drops slots that already started", () => {
    const slots = slotsFor({
      availability: [monday],
      date: "2026-09-07",
      now: new Date("2026-09-07T10:00:00Z"),
    });

    expect(slots.map((s) => s.start.toISOString())).toEqual(["2026-09-07T10:30:00.000Z"]);
  });

  it("drops the whole day once it is in the past", () => {
    expect(
      slotsFor({ availability: [monday], date: "2026-09-07", now: new Date("2026-09-08T00:00:00Z") }),
    ).toEqual([]);
  });

  it("ignores nonsense windows and unparseable dates", () => {
    expect(
      slotsFor({
        availability: [{ ...monday, endMin: monday.startMin }],
        date: "2026-09-07",
        now: new Date("2026-09-01T00:00:00Z"),
      }),
    ).toEqual([]);
    expect(
      slotsFor({
        availability: [{ ...monday, slotMins: 0 }],
        date: "2026-09-07",
        now: new Date("2026-09-01T00:00:00Z"),
      }),
    ).toEqual([]);
    expect(slotsFor({ availability: [monday], date: "2026-02-31", now: NOW })).toEqual([]);
    expect(slotsFor({ availability: [monday], date: "nope", now: NOW })).toEqual([]);
  });

  it("de-duplicates overlapping windows on the same weekday", () => {
    const slots = slotsFor({
      availability: [monday, { ...monday, startMin: 10 * 60, endMin: 12 * 60 }],
      date: "2026-09-07",
      now: new Date("2026-09-01T00:00:00Z"),
    });

    const starts = slots.map((s) => s.start.toISOString());
    expect(new Set(starts).size).toBe(starts.length);
    expect(starts).toHaveLength(6);
  });

  it("keeps a zoned window anchored to local wall clock across DST", () => {
    const window: AvailabilityWindow = {
      weekday: 1,
      startMin: 9 * 60,
      endMin: 10 * 60,
      timezone: "America/New_York",
      slotMins: 60,
    };
    const before = slotsFor({
      availability: [window],
      date: "2026-03-02",
      now: new Date("2026-01-01T00:00:00Z"),
    });
    const after = slotsFor({
      availability: [window],
      date: "2026-03-09",
      now: new Date("2026-01-01T00:00:00Z"),
    });

    // 09:00 in New York is 14:00Z under EST and 13:00Z under EDT.
    expect(before[0].start.toISOString()).toBe("2026-03-02T14:00:00.000Z");
    expect(after[0].start.toISOString()).toBe("2026-03-09T13:00:00.000Z");
    expect(before[0].label).toBe(after[0].label);
  });

  it("never offers the same instant twice across a spring-forward gap", () => {
    // 2026-03-08, America/New_York: 02:00 local never happens.
    const slots = slotsFor({
      availability: [
        { weekday: 0, startMin: 60, endMin: 5 * 60, timezone: "America/New_York", slotMins: 60 },
      ],
      date: "2026-03-08",
      now: new Date("2026-01-01T00:00:00Z"),
    });

    const starts = slots.map((s) => s.start.toISOString());
    expect(new Set(starts).size).toBe(starts.length);
    expect(starts).toEqual([
      "2026-03-08T06:00:00.000Z",
      "2026-03-08T07:00:00.000Z",
      "2026-03-08T08:00:00.000Z",
    ]);
    // Every slot is a real hour long, even the one spanning the transition.
    for (const slot of slots) {
      expect(slot.end.getTime() - slot.start.getTime()).toBe(60 * 60_000);
    }
  });
});

describe("zonedWallClockToUtc", () => {
  it("resolves wall clock in a zone to an instant", () => {
    expect(zonedWallClockToUtc(2026, 7, 4, 9 * 60, "UTC").toISOString()).toBe("2026-07-04T09:00:00.000Z");
    expect(zonedWallClockToUtc(2026, 7, 4, 9 * 60, "America/New_York").toISOString()).toBe(
      "2026-07-04T13:00:00.000Z",
    );
    expect(zonedWallClockToUtc(2026, 1, 4, 9 * 60, "Asia/Tokyo").toISOString()).toBe(
      "2026-01-04T00:00:00.000Z",
    );
  });

  it("rolls minutes past midnight into the next day", () => {
    expect(zonedWallClockToUtc(2026, 7, 4, 1440, "UTC").toISOString()).toBe("2026-07-05T00:00:00.000Z");
  });

  it("falls back to UTC for an unknown zone", () => {
    expect(zonedWallClockToUtc(2026, 7, 4, 0, "Mars/Olympus").toISOString()).toBe(
      "2026-07-04T00:00:00.000Z",
    );
  });
});

describe("time value helpers", () => {
  it("round-trips minutes and HH:MM", () => {
    expect(minutesToTimeValue(0)).toBe("00:00");
    expect(minutesToTimeValue(9 * 60 + 5)).toBe("09:05");
    expect(timeValueToMinutes("09:05")).toBe(545);
    expect(timeValueToMinutes("24:00")).toBe(1440);
  });

  it("rejects unparseable times", () => {
    expect(timeValueToMinutes("9am")).toBeNull();
    expect(timeValueToMinutes("25:00")).toBeNull();
    expect(timeValueToMinutes("09:75")).toBeNull();
  });
});
