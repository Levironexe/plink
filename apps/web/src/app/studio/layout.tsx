import type { Metadata } from "next";
import { ToastProvider } from "@plink/ui/toast";

export const metadata: Metadata = {
  title: { default: "Studio", template: "%s · Plink" },
  robots: { index: false, follow: false },
};

/**
 * Holds the toast surface for every studio route.
 *
 * `useToast` returns a silent no-op when no provider is mounted, so without
 * this the editor and publish panel reported save failures, publishes and
 * rollbacks into nothing — the operator saw no feedback at all.
 *
 * Auth stays with each page rather than moving here: the studio's pages resolve
 * a workspace or a site and need the specific 404-vs-redirect behaviour their
 * own guards give them.
 */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
