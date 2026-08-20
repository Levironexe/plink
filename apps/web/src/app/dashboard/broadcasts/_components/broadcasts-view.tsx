"use client";

import * as React from "react";
import { Mail, Send, TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@plink/ui/button";
import { TextArea, TextField } from "@plink/ui/field";
import { useToast } from "@plink/ui/toast";
import { PageHeader, EmptyState } from "../../_components/page-header";
import { cn, relativeTime } from "@plink/core/utils";

export type BroadcastRow = {
  id: string;
  subject: string;
  body: string;
  status: string;
  recipients: number;
  sentAt: string | null;
  createdAt: string;
};

const STATUS_STYLE: Record<string, string> = {
  draft: "border-line bg-canvas text-ink-soft",
  sending: "border-warning/30 bg-warning-soft text-warning-deep",
  sent: "border-brand-200 bg-brand-50 text-brand-700",
  failed: "border-danger/25 bg-danger-soft text-danger-deep",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[11px] leading-4 tracking-tight",
        STATUS_STYLE[status] ?? STATUS_STYLE.draft,
      )}
    >
      {status}
    </span>
  );
}

export function BroadcastsView({
  broadcasts: initial,
  reachable,
  unsubscribed,
  configured,
}: {
  broadcasts: BroadcastRow[];
  /** Subscribers who have not unsubscribed — the real reach of a send. */
  reachable: number;
  unsubscribed: number;
  configured: boolean;
}) {
  const { toast } = useToast();
  const [broadcasts, setBroadcasts] = React.useState(initial);
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [sendingId, setSendingId] = React.useState<string | null>(null);

  async function createDraft(thenSend: boolean) {
    setError("");
    if (!subject.trim()) {
      setError("Give your broadcast a subject");
      return;
    }
    if (!body.trim()) {
      setError("Write something to send");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim() }),
      });
      const data = (await res.json()) as { error?: string; broadcast?: BroadcastRow };
      if (!res.ok || !data.broadcast) {
        setError(data.error ?? "Could not save that draft");
        return;
      }

      setBroadcasts((prev) => [data.broadcast as BroadcastRow, ...prev]);
      setSubject("");
      setBody("");
      if (thenSend) await send(data.broadcast.id);
      else toast("Draft saved");
    } catch {
      toast("Network error — please try again", "error");
    } finally {
      setSaving(false);
    }
  }

  async function send(id: string) {
    setSendingId(id);
    setBroadcasts((prev) => prev.map((b) => (b.id === id ? { ...b, status: "sending" } : b)));
    try {
      const res = await fetch(`/api/broadcasts/${id}/send`, { method: "POST" });
      const data = (await res.json()) as { error?: string; broadcast?: BroadcastRow; delivered?: number };
      if (!res.ok || !data.broadcast) {
        setBroadcasts((prev) => prev.map((b) => (b.id === id ? { ...b, status: "failed" } : b)));
        toast(data.error ?? "Could not send that broadcast", "error");
        return;
      }
      const updated = data.broadcast;
      setBroadcasts((prev) => prev.map((b) => (b.id === id ? { ...b, ...updated } : b)));
      toast(`Sent to ${data.delivered ?? updated.recipients} subscribers`);
    } catch {
      setBroadcasts((prev) => prev.map((b) => (b.id === id ? { ...b, status: "failed" } : b)));
      toast("Network error — please try again", "error");
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:py-10">
      <PageHeader
        title="Broadcasts"
        description="Write once, land in every inbox on your list. Every send carries a one-click unsubscribe."
        actions={
          <ButtonLink href="/dashboard/audience" variant="outline">
            Manage audience
          </ButtonLink>
        }
      />

      {!configured && (
        <div className="mt-8 flex items-start gap-3 rounded-xl border border-line bg-surface p-5 shadow-soft">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-canvas text-ink-muted">
            <TriangleAlert className="size-[18px]" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-ink">Email not configured</p>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
              Add{" "}
              <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[12.5px] text-ink">RESEND_API_KEY</code>{" "}
              to <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[12.5px] text-ink">.env.local</code>{" "}
              and restart the dev server. You can still write and save drafts — sending stays disabled until then.
            </p>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-5 shadow-soft">
          <p className="eyebrow">Reachable</p>
          <p className="mt-2 text-[30px] leading-none font-semibold tracking-[-0.04em] text-ink">{reachable}</p>
          <p className="mt-1.5 text-[13px] text-ink-muted">subscribed right now</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5 shadow-soft">
          <p className="eyebrow">Unsubscribed</p>
          <p className="mt-2 text-[30px] leading-none font-semibold tracking-[-0.04em] text-ink">{unsubscribed}</p>
          <p className="mt-1.5 text-[13px] text-ink-muted">opted out of broadcasts</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5 shadow-soft">
          <p className="eyebrow">Sent</p>
          <p className="mt-2 text-[30px] leading-none font-semibold tracking-[-0.04em] text-ink">
            {broadcasts.filter((b) => b.status === "sent").length}
          </p>
          <p className="mt-1.5 text-[13px] text-ink-muted">campaigns delivered</p>
        </div>
      </div>

      <section className="mt-8 rounded-xl border border-line bg-surface p-5 shadow-soft sm:p-6">
        <h2 className="text-[19px] font-semibold tracking-[-0.03em] text-ink">New broadcast</h2>
        <p className="mt-1 text-[14px] text-ink-soft">
          Plain text, written like a note. Blank lines become paragraphs.
        </p>

        <div className="mt-5 flex flex-col gap-4">
          <TextField
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="New drop: the spring preset pack"
            maxLength={140}
          />
          <TextArea
            label="Message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Hey —\n\nI just added five new presets to the shop. Here's what's inside…"}
            className="min-h-[180px]"
            maxLength={20000}
            error={error}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => createDraft(true)} loading={saving} disabled={!configured || reachable === 0}>
              <Send className="size-4" /> Send to {reachable} {reachable === 1 ? "subscriber" : "subscribers"}
            </Button>
            <Button variant="secondary" onClick={() => createDraft(false)} disabled={saving}>
              Save draft
            </Button>
            {reachable === 0 && (
              <span className="text-[13px] text-ink-muted">Add an email capture block to start collecting.</span>
            )}
          </div>
        </div>
      </section>

      {broadcasts.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={Mail}
            title="No broadcasts yet"
            body="Write your first one above. Drafts stay here until you send them, and every send records how many inboxes it reached."
          />
        </div>
      ) : (
        <section className="mt-8 overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
          <div className="border-b border-line bg-canvas px-4 py-2.5">
            <p className="eyebrow">History</p>
          </div>
          <ul className="divide-y divide-line">
            {broadcasts.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[14.5px] font-medium text-ink">{b.subject}</p>
                    <StatusPill status={b.status} />
                  </div>
                  <p className="mt-0.5 truncate text-[12.5px] text-ink-muted">
                    {b.status === "sent"
                      ? `${b.recipients} ${b.recipients === 1 ? "recipient" : "recipients"} · sent ${relativeTime(b.sentAt ?? b.createdAt)}`
                      : `drafted ${relativeTime(b.createdAt)}`}
                  </p>
                </div>
                {b.status !== "sent" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => send(b.id)}
                    loading={sendingId === b.id}
                    disabled={!configured || reachable === 0 || b.status === "sending"}
                  >
                    <Send className="size-4" /> Send
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
