"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleCheck, RefreshCw, Sparkles, Wand } from "lucide-react";
import { Button } from "@plink/ui/button";
import { cn } from "@plink/core/utils";
import type { SiteDocument } from "@plink/core/site-schema";
import { SiteRenderer } from "@/components/site/site-renderer";
import { applyProposal, discardProposal } from "../actions";

/**
 * Propose → review → apply, the same three beats as the dashboard's AI builder,
 * scaled up from a page to a whole website.
 *
 * The proposal is reviewed in the real renderer (`mode="preview"`), not a
 * summary of it, because the thing being approved is a website. Only ids travel
 * back to the server actions — the document the operator sees is the one already
 * stored on the `AiGeneration` row, and that row is what gets applied.
 */

type Proposal = { generationId: string; document: SiteDocument };

export type GenerateFlowProps = {
  siteId: string;
  siteName: string;
  template: string;
  /** Server-side `aiEnabled()`; a 503 from the API overrides it either way. */
  enabled?: boolean;
};

export function GenerateFlow({ siteId, siteName, template, enabled = true }: GenerateFlowProps) {
  const router = useRouter();
  const [proposal, setProposal] = React.useState<Proposal | null>(null);
  const [activePath, setActivePath] = React.useState("/");
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState<"apply" | "discard" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [applied, setApplied] = React.useState(false);
  const [serverDisabled, setServerDisabled] = React.useState(false);

  async function generate() {
    if (loading) return;
    setLoading(true);
    setError(null);

    // Regenerating past a standing proposal is a discard; the metric should
    // say so rather than leaving an orphan `proposed` row behind.
    const previous = proposal;
    setProposal(null);
    if (previous) await discardProposal(siteId, previous.generationId).catch(() => undefined);

    try {
      const res = await fetch("/api/ai/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
      });
      const data = (await res.json().catch(() => null)) as
        | { generationId?: string; document?: SiteDocument; error?: string; code?: string }
        | null;

      if (res.status === 503 || data?.code === "ai_disabled") {
        setServerDisabled(true);
        return;
      }
      if (!res.ok || !data?.document || !data.generationId) {
        setError(data?.error ?? "Something went wrong. Try again.");
        return;
      }

      setProposal({ generationId: data.generationId, document: data.document });
      setActivePath(data.document.pages[0]?.path ?? "/");
      setApplied(false);
    } catch {
      setError("Couldn’t reach the website generator. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!proposal || busy) return;
    setBusy("apply");
    setError(null);
    try {
      const result = await applyProposal(siteId, proposal.generationId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setApplied(true);
      setProposal(null);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function discard() {
    if (!proposal || busy) return;
    setBusy("discard");
    setError(null);
    try {
      const result = await discardProposal(siteId, proposal.generationId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setProposal(null);
    } finally {
      setBusy(null);
    }
  }

  if (!enabled || serverDisabled) return <NotConfigured />;

  return (
    <div className="flex flex-col gap-5">
      <section className="card p-6">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 font-mono text-[12px] leading-4 text-ink-soft">
          <Sparkles className="size-3.5" aria-hidden />
          AI website generator
        </span>

        <h2 className="mt-3 text-[20px] leading-tight font-semibold tracking-[-0.04em] text-ink">
          Turn the brief into a first draft.
        </h2>
        <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-ink-soft">
          The generator reads {siteName}’s brief and proposes a whole site on the{" "}
          <span className="font-mono text-[13px]">{template}</span> template — pages, sections,
          blocks and a theme. Nothing is saved until you apply it, and applying only writes the
          draft. Publishing stays your call.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={generate} loading={loading}>
            {!loading && (proposal ? <RefreshCw className="size-4" aria-hidden /> : <Wand className="size-4" aria-hidden />)}
            {loading ? "Designing the site…" : proposal ? "Regenerate" : "Generate site"}
          </Button>
          <p className="text-[13px] text-ink-muted" role="status" aria-live="polite">
            {loading
              ? "Choosing pages, sections and a theme — up to a minute."
              : "6 generations an hour."}
          </p>
        </div>

        {error && (
          <p className="mt-3 text-[13px] font-medium text-danger" role="alert">
            {error}
          </p>
        )}

        {applied && !proposal && (
          <div className="mt-5 flex items-start gap-3 rounded-md border border-line bg-canvas p-4">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
            <p className="text-[14px] leading-relaxed text-ink-soft">
              Saved to the draft.{" "}
              <Link
                href={`/studio/${siteId}`}
                className="font-medium text-ink underline underline-offset-4"
              >
                Open the editor
              </Link>{" "}
              to refine it, then publish when it is ready.
            </p>
          </div>
        )}
      </section>

      {loading && !proposal && <Skeleton />}

      {proposal && (
        <Review
          proposal={proposal}
          activePath={activePath}
          onSelectPath={setActivePath}
          busy={busy}
          onApply={apply}
          onDiscard={discard}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

export function NotConfigured() {
  return (
    <section className="card p-6" aria-labelledby="ai-disabled-heading">
      <h2
        id="ai-disabled-heading"
        className="text-[16px] font-medium tracking-[-0.02em] text-ink"
      >
        AI not configured
      </h2>
      <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-ink-soft">
        Add{" "}
        <code className="rounded-md border border-line bg-canvas px-1.5 py-0.5 font-mono text-[12.5px] text-ink">
          AI_GATEWAY_API_KEY
        </code>{" "}
        to <span className="font-mono text-[12.5px]">.env.local</span> to turn the website
        generator on. Briefs, the editor and publishing all work without it.
      </p>
    </section>
  );
}

function Skeleton() {
  return (
    <div className="card p-4" aria-hidden>
      <div className="h-3 w-28 rounded-md bg-line" />
      <div className="mt-4 flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 rounded-md bg-line/70" style={{ opacity: 1 - i * 0.16 }} />
        ))}
      </div>
    </div>
  );
}

function Review({
  proposal,
  activePath,
  onSelectPath,
  busy,
  onApply,
  onDiscard,
}: {
  proposal: Proposal;
  activePath: string;
  onSelectPath: (path: string) => void;
  busy: "apply" | "discard" | null;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const { document } = proposal;
  const sections = document.pages.reduce((n, page) => n + page.sections.length, 0);
  const blocks = document.pages.reduce(
    (n, page) => n + page.sections.reduce((m, section) => m + section.blocks.length, 0),
    0,
  );

  return (
    <section className="card overflow-hidden" aria-labelledby="proposal-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-6 py-4">
        <h3 id="proposal-heading" className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
          Proposed site
        </h3>
        <span className="font-mono text-[12px] text-ink-muted">
          {document.pages.length} page{document.pages.length === 1 ? "" : "s"} · {sections} section
          {sections === 1 ? "" : "s"} · {blocks} block{blocks === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-line px-6 py-3">
        {document.pages.map((page) => (
          <button
            key={page.id}
            type="button"
            onClick={() => onSelectPath(page.path)}
            aria-pressed={page.path === activePath}
            className={cn(
              "rounded-md border px-2.5 py-1 text-[13px] font-medium tracking-[-0.01em] transition-colors",
              page.path === activePath
                ? "border-line-strong/50 bg-canvas-deep text-ink"
                : "border-line bg-surface text-ink-soft hover:text-ink",
            )}
          >
            {page.title}
            <span className="ml-1.5 font-mono text-[11.5px] text-ink-muted">{page.path}</span>
          </button>
        ))}
      </div>

      {/* The proposal reviewed as the website it is, not a summary of one. */}
      <div className="max-h-[600px] overflow-y-auto bg-canvas-deep">
        <SiteRenderer document={document} mode="preview" path={activePath} />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-6 py-4">
        <Button onClick={onApply} loading={busy === "apply"} disabled={busy !== null}>
          Apply to the draft
          {busy !== "apply" && <ArrowRight className="size-4" aria-hidden />}
        </Button>
        <Button
          variant="ghost"
          onClick={onDiscard}
          loading={busy === "discard"}
          disabled={busy !== null}
        >
          Discard
        </Button>
        <p className="text-[13px] text-ink-muted">Applying writes the draft. It never publishes.</p>
      </div>
    </section>
  );
}
