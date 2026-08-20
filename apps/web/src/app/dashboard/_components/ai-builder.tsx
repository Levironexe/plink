"use client";

import * as React from "react";
import { ArrowRight, KeyRound, Link2, Sparkles, Wand } from "lucide-react";
import { Button } from "@plink/ui/button";
import { TextArea } from "@plink/ui/field";
import { blockDefinition } from "@plink/core/blocks";
import { THEME_PRESETS, backgroundCss, radiusCss } from "@plink/core/themes";
import { cn, hostOf } from "@plink/core/utils";
import type { GeneratedBlock, GeneratedPage } from "@plink/ai";

/** The shape handed to `onApply`. Re-exported so parents need one import. */
export type { GeneratedPage, GeneratedBlock } from "@plink/ai";

export type AiBuilderProps = {
  /**
   * Receives the sanitised proposal when the creator accepts it. The parent
   * owns persistence — this component never calls a server action itself.
   */
  onApply: (page: GeneratedPage) => void | Promise<void>;
  /** Pass `aiEnabled()` from the server. Defaults to enabled. */
  enabled?: boolean;
  /** Existing socials, used as extra context for the model. */
  socials?: { platform: string; url: string }[];
  className?: string;
};

const EXAMPLES = [
  "I'm a ceramicist in Lisbon who sells workshops and a newsletter",
  "Indie game developer shipping a devlog every Friday",
  "Wedding photographer taking bookings for next spring",
  "Strength coach selling 1:1 programmes and a free guide",
];

export function AiBuilder({ onApply, enabled = true, socials, className }: AiBuilderProps) {
  const [prompt, setPrompt] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState<GeneratedPage | null>(null);
  // A 503 from the API is the authoritative signal, whatever the prop says.
  const [serverDisabled, setServerDisabled] = React.useState(false);
  const configured = enabled && !serverDisabled;

  async function generate() {
    if (loading || prompt.trim().length < 12) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), socials }),
      });
      const data = (await res.json().catch(() => null)) as
        | { page?: GeneratedPage; error?: string; code?: string }
        | null;

      if (res.status === 503 || data?.code === "ai_disabled") {
        setServerDisabled(true);
        return;
      }
      if (!res.ok || !data?.page) {
        setError(data?.error ?? "Something went wrong. Try again.");
        return;
      }
      setPage(data.page);
    } catch {
      setError("Couldn’t reach the page builder. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!page || applying) return;
    setApplying(true);
    try {
      await onApply(page);
      setPage(null);
      setPrompt("");
    } finally {
      setApplying(false);
    }
  }

  if (!configured) return <NotConfigured className={className} />;

  return (
    <section
      className={cn("rounded-[12px] border border-line bg-surface p-5 shadow-soft sm:p-6", className)}
      aria-labelledby="ai-builder-heading"
    >
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 font-mono text-[12px] leading-4 text-ink-soft">
        <Sparkles className="size-3.5" aria-hidden />
        AI builder
      </span>

      <h2
        id="ai-builder-heading"
        className="mt-3 text-[20px] leading-tight font-semibold tracking-[-0.04em] text-ink"
      >
        Describe yourself, get a page.
      </h2>
      <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-ink-soft">
        One or two sentences about what you do and what you sell. Nothing is saved until
        you apply it.
      </p>

      <div className="mt-5">
        <TextArea
          label="What do you do?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="I'm a ceramicist in Lisbon who sells studio workshops and writes a monthly newsletter."
          rows={3}
          maxLength={1200}
          disabled={loading}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setPrompt(example)}
            disabled={loading}
            className="rounded-md border border-line bg-canvas px-2.5 py-1 text-left font-mono text-[12px] leading-4 text-ink-soft transition-colors hover:border-line-strong/50 hover:text-ink disabled:opacity-50"
          >
            {example}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={generate} loading={loading} disabled={prompt.trim().length < 12}>
          {!loading && <Wand className="size-4" aria-hidden />}
          {loading ? "Building your page…" : page ? "Generate again" : "Generate page"}
        </Button>
        <p className="text-[13px] text-ink-muted" role="status" aria-live="polite">
          {loading
            ? "Choosing blocks and a theme — about ten seconds."
            : error
              ? ""
              : "10 generations an hour."}
        </p>
      </div>

      {error && (
        <p className="mt-3 text-[13px] font-medium text-danger" role="alert">
          {error}
        </p>
      )}

      {loading && !page && <Skeleton />}

      {page && (
        <Preview
          page={page}
          applying={applying}
          onApply={apply}
          onDiscard={() => setPage(null)}
        />
      )}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── */

function NotConfigured({ className }: { className?: string }) {
  return (
    <section
      className={cn("rounded-[12px] border border-line bg-canvas p-5 sm:p-6", className)}
      aria-labelledby="ai-disabled-heading"
    >
      <div className="flex items-start gap-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line bg-surface text-ink-muted">
          <KeyRound className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="ai-disabled-heading" className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
            AI not configured
          </h2>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
            Add{" "}
            <code className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[12.5px] text-ink">
              AI_GATEWAY_API_KEY
            </code>{" "}
            to <span className="font-mono text-[12.5px]">.env.local</span> to turn the page
            builder on. Everything else works without it.
          </p>
        </div>
      </div>
    </section>
  );
}

function Skeleton() {
  return (
    <div className="mt-5 rounded-[12px] border border-line bg-canvas p-4" aria-hidden>
      <div className="h-3 w-24 rounded-md bg-line" />
      <div className="mt-3 flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-10 rounded-md bg-line/70"
            style={{ opacity: 1 - i * 0.18 }}
          />
        ))}
      </div>
    </div>
  );
}

function Preview({
  page,
  applying,
  onApply,
  onDiscard,
}: {
  page: GeneratedPage;
  applying: boolean;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const { profile, theme, blocks } = page;
  const presetName = THEME_PRESETS.find((p) => p.id === theme.presetId)?.name ?? "Custom";

  return (
    <div className="mt-6 border-t border-line pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">Proposed page</h3>
        <span className="font-mono text-[12px] text-ink-muted">
          {blocks.length} block{blocks.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <div className="rounded-[12px] border border-line bg-canvas p-4">
          <p className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
            {profile.displayName || "Untitled"}
          </p>
          {profile.category && (
            <p className="mt-0.5 font-mono text-[12px] text-ink-muted">{profile.category}</p>
          )}
          {profile.bio && (
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{profile.bio}</p>
          )}
        </div>

        <ThemeSwatch theme={theme} presetName={presetName} />
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {blocks.map((block) => (
          <BlockRow key={block.position} block={block} />
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button onClick={onApply} loading={applying}>
          Apply to my page
          {!applying && <ArrowRight className="size-4" aria-hidden />}
        </Button>
        <Button variant="ghost" onClick={onDiscard} disabled={applying}>
          Discard
        </Button>
      </div>
    </div>
  );
}

function ThemeSwatch({
  theme,
  presetName,
}: {
  theme: GeneratedPage["theme"];
  presetName: string;
}) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-line">
      <div
        className="flex h-[86px] flex-col items-center justify-center gap-2 px-4"
        style={backgroundCss(theme)}
      >
        <span
          className="h-6 w-6 rounded-full"
          style={{ background: theme.textColor, opacity: 0.9 }}
        />
        <span
          className="h-5 w-full max-w-[120px]"
          style={{
            background: theme.buttonStyle === "outline" ? "transparent" : theme.buttonColor,
            border: theme.buttonStyle === "outline" ? `1.5px solid ${theme.buttonColor}` : undefined,
            borderRadius: radiusCss(theme.buttonRadius),
          }}
        />
      </div>
      <div className="bg-surface px-3 py-2">
        <p className="text-[13px] font-medium tracking-[-0.02em] text-ink">{presetName}</p>
        <p className="mt-0.5 font-mono text-[11.5px] text-ink-muted">
          {theme.buttonStyle} · {theme.fontFamily}
        </p>
      </div>
    </div>
  );
}

function BlockRow({ block }: { block: GeneratedBlock }) {
  const def = blockDefinition(block.type);
  const Icon = def?.icon;
  const host = block.url ? hostOf(block.url) : "";

  return (
    <li className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-canvas text-ink-soft">
        {Icon ? <Icon className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium tracking-[-0.02em] text-ink">
          {block.title || def?.label || block.type}
        </span>
        {(block.subtitle || host) && (
          <span className="mt-0.5 block truncate text-[12.5px] text-ink-muted">
            {block.subtitle || host}
          </span>
        )}
      </span>
      <span className="shrink-0 font-mono text-[11.5px] text-ink-muted">{block.type}</span>
    </li>
  );
}
