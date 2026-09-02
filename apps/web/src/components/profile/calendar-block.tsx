"use client";

import * as React from "react";
import { CalendarDays, Check, ChevronRight, LoaderCircle } from "lucide-react";
import { buttonCss, radiusCss, rgba } from "@plink/core/themes";
import { EffectSurface } from "./effect-surface";
import { parseConfig } from "@plink/core/blocks";
import { upcomingDateKeys } from "@plink/core/scheduling";
import { safeUrl } from "@plink/core/utils";
import type { PublicBlock, PublicProfile } from "@plink/core/profile-types";

type SlotResponse = {
  date: string;
  timezone: string;
  slotMins: number;
  weekdays: number[];
  slots: { start: string; end: string; label: string }[];
};

type Props = {
  block: PublicBlock;
  profile: PublicProfile;
  /** In preview mode nothing is fetched and nothing can be booked. */
  preview?: boolean;
  onTrack?: (blockId: string) => void;
};

const DAYS_AHEAD = 14;

/** "Tue" / "9" for a YYYY-MM-DD key, read at midday so no zone can shift it. */
function dayParts(key: string) {
  const date = new Date(`${key}T12:00:00Z`);
  return {
    weekday: date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    day: date.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" }),
    index: date.getUTCDay(),
  };
}

function longSlot(iso: string, timezone: string) {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone || undefined,
  });
}

/**
 * The public booking widget. Slots come from the creator's availability minus
 * anything already taken, and the same check runs again server-side when the
 * booking is written — the list here is a convenience, never the authority.
 */
export function CalendarBlock({ block, profile, preview = false, onTrack }: Props) {
  const { theme } = profile;
  const config = parseConfig<{ buttonLabel?: string; timezone?: string }>(block.config);

  const [data, setData] = React.useState<SlotResponse | null>(null);
  const [dates, setDates] = React.useState<string[]>([]);
  const [selectedDate, setSelectedDate] = React.useState<string | null>(
    preview ? PREVIEW_DATES[0] : null,
  );
  const [loading, setLoading] = React.useState(!preview);
  const [unavailable, setUnavailable] = React.useState(false);

  const [slot, setSlot] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [note, setNote] = React.useState("");
  const [state, setState] = React.useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [confirmed, setConfirmed] = React.useState<{ label: string; timezone: string } | null>(null);

  // Nothing is written to state before the first `await`, so the mount effect
  // below never triggers a synchronous cascade of renders.
  const load = React.useCallback(
    async (date?: string, signal?: AbortSignal) => {
      try {
        const query = new URLSearchParams({ username: profile.username });
        if (date) query.set("date", date);

        const res = await fetch(`/api/bookings/slots?${query.toString()}`, { signal });
        if (!res.ok) {
          setUnavailable(true);
          return;
        }

        const payload = (await res.json()) as SlotResponse;
        setData(payload);
        setSelectedDate(payload.date);
        setUnavailable(payload.weekdays.length === 0);
        // The first response fixes the calendar window, so every chip is a real
        // day in the creator's own timezone.
        setDates((current) =>
          current.length > 0
            ? current
            : upcomingDateKeys(new Date(`${payload.date}T12:00:00Z`), DAYS_AHEAD, "UTC"),
        );
      } catch (cause) {
        if ((cause as Error).name !== "AbortError") setUnavailable(true);
      } finally {
        setLoading(false);
      }
    },
    [profile.username],
  );

  React.useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    // Deferred a tick so the first paint is never blocked by, or re-entered
    // from, the fetch — the same shape the shared hooks in `lib/hooks` use.
    const timer = setTimeout(() => void load(undefined, controller.signal), 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [preview, load]);

  function pickDate(date: string) {
    if (preview || date === selectedDate) return;
    setSelectedDate(date);
    setSlot(null);
    setLoading(true);
    setError(null);
    void load(date);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (preview || !slot) return;

    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: profile.username,
          name,
          email,
          note,
          start: slot,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      const payload = (await res.json().catch(() => null)) as
        | { error?: string; booking?: { start: string } }
        | null;

      if (!res.ok) {
        setError(payload?.error ?? "That time is no longer available");
        setState("idle");
        if (selectedDate) {
          setLoading(true);
          void load(selectedDate);
        }
        return;
      }

      onTrack?.(block.id);
      setConfirmed({
        label: longSlot(payload?.booking?.start ?? slot, Intl.DateTimeFormat().resolvedOptions().timeZone),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setState("done");
    } catch {
      setError("Something went wrong. Try again.");
      setState("idle");
    }
  }

  const surface = buttonCss(theme);
  const chip = (active: boolean, disabled = false): React.CSSProperties => ({
    borderRadius: radiusCss(theme.buttonRadius) === "9999px" ? "9999px" : "12px",
    border: `1px solid ${active ? theme.accentColor : rgba(theme.textColor, 0.22)}`,
    background: active ? theme.accentColor : rgba(theme.textColor, 0.06),
    color: active ? theme.bgColor : theme.textColor,
    opacity: disabled ? 0.35 : 1,
  });

  const openWeekdays = data?.weekdays ?? [];
  const slots = data?.slots ?? [];

  /* Success state — the widget's whole job is done. */
  if (state === "done" && confirmed) {
    return (
      <EffectSurface theme={theme} className="w-full p-4" style={{ ...surface, textAlign: "left" }}>
        <p className="flex items-center gap-2 text-[15px] font-bold">
          <Check className="size-4" aria-hidden />
          You’re booked
        </p>
        <p className="mt-1.5 text-[13.5px] opacity-80">{confirmed.label}</p>
        <p className="mt-1 text-[12.5px] opacity-60">
          A copy is on its way to {email}. Times shown in {confirmed.timezone}.
        </p>
      </EffectSurface>
    );
  }

  return (
    <EffectSurface theme={theme} className="w-full p-4" style={{ ...surface, textAlign: "left" }}>
      <p className="flex items-center gap-2 text-[15px] font-bold">
        <CalendarDays className="size-4 shrink-0" aria-hidden />
        {block.title || "Book a time"}
      </p>
      {block.subtitle && <p className="mt-0.5 text-[13px] opacity-75">{block.subtitle}</p>}

      {/* Nothing to book — fall back to whatever link the creator set. */}
      {!preview && unavailable ? (
        <div className="mt-3">
          <p className="text-[13.5px] opacity-75">No times are open right now.</p>
          {block.url && block.url !== "#" && (
            <a
              href={safeUrl(block.url)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onTrack?.(block.id)}
              className="mt-2 inline-flex items-center gap-1 text-[13.5px] font-semibold underline"
            >
              Open booking page
              <ChevronRight className="size-3.5" aria-hidden />
            </a>
          )}
        </div>
      ) : (
        <>
          {/* Date row */}
          <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
            {(preview ? PREVIEW_DATES : dates).map((key) => {
              const parts = dayParts(key);
              const closed = !preview && openWeekdays.length > 0 && !openWeekdays.includes(parts.index);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={preview || closed}
                  aria-pressed={key === selectedDate}
                  onClick={() => pickDate(key)}
                  className="flex w-14 shrink-0 flex-col items-center gap-0.5 py-2 text-[12px] font-semibold transition"
                  style={chip(key === selectedDate, closed)}
                >
                  <span className="opacity-70">{parts.weekday}</span>
                  <span className="text-[15px] font-bold">{parts.day}</span>
                </button>
              );
            })}
            {!preview && dates.length === 0 && loading && (
              <div className="h-[52px] flex-1 animate-pulse rounded-xl" style={{ background: rgba(theme.textColor, 0.08) }} />
            )}
          </div>

          {/* Slot grid */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(preview ? PREVIEW_SLOTS : slots).map((item) => {
              const value = preview ? item.label : item.start;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={preview}
                  aria-pressed={!preview && slot === item.start}
                  onClick={() => setSlot(item.start)}
                  className="py-2 text-[13px] font-semibold transition"
                  style={chip(!preview && slot === item.start)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {!preview && !loading && slots.length === 0 && (
            <p className="mt-3 text-[13px] opacity-70">Nothing free on this day — try another.</p>
          )}
          {!preview && loading && slots.length === 0 && (
            <p className="mt-3 flex items-center gap-2 text-[13px] opacity-70">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
              Loading times…
            </p>
          )}

          {/* Details */}
          {!preview && slot && (
            <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                aria-label="Your name"
                className="w-full rounded-xl border px-3 py-2.5 text-[14px] outline-none"
                style={fieldStyle(theme)}
              />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                aria-label="Your email"
                className="w-full rounded-xl border px-3 py-2.5 text-[14px] outline-none"
                style={fieldStyle(theme)}
              />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything I should know? (optional)"
                aria-label="Note"
                rows={2}
                className="w-full resize-y rounded-xl border px-3 py-2.5 text-[14px] outline-none"
                style={fieldStyle(theme)}
              />
              <button
                type="submit"
                disabled={state === "sending"}
                className="w-full rounded-xl py-2.5 text-[14px] font-bold transition disabled:opacity-60"
                style={{ background: theme.accentColor, color: theme.bgColor }}
              >
                {state === "sending" ? "Booking…" : (config.buttonLabel ?? "Confirm booking")}
              </button>
            </form>
          )}

          {error && (
            <p className="mt-2 text-[13px] font-medium" style={{ color: theme.accentColor }}>
              {error}
            </p>
          )}
          {data?.timezone && !preview && (
            <p className="mt-2 text-[12px] opacity-55">Times shown in {data.timezone}.</p>
          )}
        </>
      )}
    </EffectSurface>
  );
}

function fieldStyle(theme: PublicProfile["theme"]): React.CSSProperties {
  return {
    borderColor: rgba(theme.textColor, 0.25),
    background: rgba(theme.textColor, 0.07),
    color: theme.textColor,
  };
}

/* Static stand-ins so an editor preview looks right without touching the API. */
const PREVIEW_DATES = ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11"];
const PREVIEW_SLOTS = [
  { start: "preview-1", end: "", label: "9:00 AM" },
  { start: "preview-2", end: "", label: "9:30 AM" },
  { start: "preview-3", end: "", label: "10:00 AM" },
  { start: "preview-4", end: "", label: "1:00 PM" },
  { start: "preview-5", end: "", label: "1:30 PM" },
  { start: "preview-6", end: "", label: "2:00 PM" },
];
