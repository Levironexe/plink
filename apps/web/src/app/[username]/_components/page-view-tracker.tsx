"use client";

import { useEffect } from "react";

/**
 * Fires a single page-view beacon per mount. Runs on the client so bots and
 * prefetches that never render don't inflate a creator's numbers.
 */
export function PageViewTracker({ userId }: { userId: string }) {
  useEffect(() => {
    if (userId.startsWith("demo-")) return;
    const body = JSON.stringify({ userId, referrer: document.referrer });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track/view", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/track/view", { method: "POST", body, keepalive: true });
    }
  }, [userId]);

  return null;
}
