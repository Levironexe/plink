"use client";

import * as React from "react";
import { Download, Mails, Search, Trash2, Users } from "lucide-react";
import { Button, ButtonLink } from "@plink/ui/button";
import { PageHeader, EmptyState } from "../../_components/page-header";
import { useToast } from "@plink/ui/toast";
import { deleteSubscriber } from "@/app/dashboard/actions";
import { relativeTime } from "@plink/core/utils";

export type SubscriberRow = {
  id: string;
  email: string;
  name: string;
  source: string;
  createdAt: string;
};

export function AudienceView({
  subscribers: initial,
  growth,
  plan,
}: {
  subscribers: SubscriberRow[];
  growth: { label: string; value: number }[];
  plan: string;
}) {
  const { toast } = useToast();
  const [subscribers, setSubscribers] = React.useState(initial);
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subscribers;
    return subscribers.filter(
      (s) => s.email.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
    );
  }, [subscribers, query]);

  const limit = plan === "free" ? 500 : Infinity;
  const usage = Math.min(100, Math.round((subscribers.length / (limit === Infinity ? 1 : limit)) * 100));

  async function remove(id: string) {
    const snapshot = subscribers;
    setSubscribers((prev) => prev.filter((s) => s.id !== id));
    const res = await deleteSubscriber(id);
    if (!res.ok) {
      setSubscribers(snapshot);
      toast(res.error, "error");
    }
  }

  const peak = Math.max(1, ...growth.map((g) => g.value));

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:py-10">
      <PageHeader
        title="Audience"
        description="Everyone who signed up through an email capture block. The list is yours — export it any time."
        actions={
          <>
            <ButtonLink href="/api/subscribers/export" variant="outline">
              <Download className="size-4" /> Export CSV
            </ButtonLink>
            <ButtonLink href="/dashboard/broadcasts" variant="primary">
              <Mails className="size-4" /> Send a broadcast
            </ButtonLink>
          </>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-5 shadow-soft">
          <p className="font-mono text-[12px] leading-4 text-ink-muted">Subscribers</p>
          <p className="mt-2 text-[30px] leading-none font-semibold text-ink">{subscribers.length}</p>
          {plan === "free" && (
            <>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-canvas">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${usage}%` }} />
              </div>
              <p className="mt-1.5 text-[12.5px] text-ink-muted">{subscribers.length} of 500 on Free</p>
            </>
          )}
        </div>

        <div className="rounded-xl border border-line bg-surface p-5 shadow-soft sm:col-span-2">
          <p className="font-mono text-[12px] leading-4 text-ink-muted">New sign-ups</p>
          <div className="mt-4 flex h-16 items-end gap-1">
            {growth.map((g) => (
              <div
                key={g.label}
                className="min-h-[3px] flex-1 rounded-t bg-gradient-to-t from-brand-300 to-brand-500"
                style={{ height: `${Math.max(4, (g.value / peak) * 100)}%` }}
                title={`${g.label}: ${g.value}`}
              />
            ))}
          </div>
          <p className="mt-2 text-[12.5px] text-ink-muted">Last {growth.length} days</p>
        </div>
      </div>

      {subscribers.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={Users}
            title="No subscribers yet"
            body="Add an Email capture block to your page — every sign-up lands here, ready to export."
            action={<ButtonLink href="/dashboard">Add an email block</ButtonLink>}
          />
        </div>
      ) : (
        <section className="mt-8 overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <Search className="size-4 shrink-0 text-ink-muted" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by email or name"
              aria-label="Search subscribers"
              className="min-w-0 flex-1 border-0 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-ink-muted"
            />
            <span className="shrink-0 text-[13px] font-semibold text-ink-muted">{filtered.length}</span>
          </div>

          <ul className="divide-y divide-line">
            {filtered.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-canvas text-[13px] font-bold text-ink-soft">
                  {s.email[0]?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold text-ink">{s.email}</p>
                  <p className="truncate text-[12.5px] text-ink-muted">
                    {s.name || "—"} · via {s.source} · {relativeTime(s.createdAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(s.id)}
                  aria-label={`Remove ${s.email}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-4 py-10 text-center text-[14px] text-ink-muted">No matches.</li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
