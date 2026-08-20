"use client";

import * as React from "react";

/**
 * Runs `save` at most once per `delay` after the latest call, and flushes any
 * pending write when the component unmounts or the tab is hidden.
 */
export function useDebouncedSave<T>(save: (value: T) => void | Promise<void>, delay = 550) {
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = React.useRef<T | null>(null);
  const saveRef = React.useRef(save);

  React.useEffect(() => {
    saveRef.current = save;
  });

  const flush = React.useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current !== null) {
      const value = pending.current;
      pending.current = null;
      void saveRef.current(value);
    }
  }, []);

  const schedule = React.useCallback(
    (value: T) => {
      pending.current = value;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [delay, flush],
  );

  React.useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  return { schedule, flush };
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export type UsernameStatus = "idle" | "short" | "checking" | "available" | "taken";

/**
 * Debounced availability check for a username. The result is tagged with the
 * value it was fetched for, so a stale response can never label the current
 * input, and no state is written synchronously during the effect.
 */
export function useUsernameAvailability(username: string, skip?: string) {
  const [result, setResult] = React.useState<{
    for: string;
    status: "checking" | "available" | "taken";
    reason?: string;
  } | null>(null);

  React.useEffect(() => {
    if (username.length < 3) return;
    if (skip !== undefined && username === skip) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setResult({ for: username, status: "checking" });
      try {
        const res = await fetch(`/api/username/check?u=${encodeURIComponent(username)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { available: boolean; reason?: string };
        setResult({
          for: username,
          status: data.available ? "available" : "taken",
          reason: data.reason,
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResult(null);
      }
    }, 330);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [username, skip]);

  const matched = result?.for === username ? result : null;

  const status: UsernameStatus =
    username.length === 0
      ? "idle"
      : username.length < 3
        ? "short"
        : skip !== undefined && username === skip
          ? "idle"
          : (matched?.status ?? "checking");

  return { status, reason: matched?.reason };
}
