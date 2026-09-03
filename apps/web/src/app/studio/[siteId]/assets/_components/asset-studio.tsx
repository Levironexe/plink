"use client";

import * as React from "react";
import { Check, Copy, ImagePlus, Sparkles, TriangleAlert, Wand2 } from "lucide-react";
import { Button } from "@plink/ui/button";
import { TextArea } from "@plink/ui/field";
import { ToastProvider, useToast } from "@plink/ui/toast";
import { cn } from "@plink/core/utils";
import type { AssetKind } from "@plink/ai/assets";
import { applyAsset } from "../actions";
import type { AssetTarget, AssetTargetOption } from "../_lib/apply-asset";

/**
 * The asset library panel: one form that generates, one grid that remembers,
 * and — since `feat/asset-apply` — one control per card that puts an image into
 * the site's draft (docs/specs/asset-apply/spec.md). Copy-URL stays: it is
 * still the way to hand a link to something outside the studio.
 *
 * `AssetKind` is imported as a *type* and the kind list arrives as a prop from
 * the server page. A value import from `@plink/ai/assets` would pull the whole
 * AI SDK into the browser bundle — `@plink/ai` is not marked side-effect-free,
 * so tree-shaking would not save us. The `Record<AssetKind, …>` tables below
 * still fail to compile if the package ever grows a fourth kind. The placement
 * list arrives the same way, so the schema never crosses into this bundle
 * either; only the two `AssetTarget` types do, and types are erased.
 */

export type AssetSummary = {
  id: string;
  /** `Asset.kind`: "ai" or "upload" — how the row got here. */
  kind: string;
  /** The shape it was generated for. */
  assetKind: AssetKind;
  url: string;
  mimeType: string;
  prompt: string;
  createdAt: string;
};

const KIND_LABELS: Record<AssetKind, string> = {
  hero: "Hero",
  banner: "Banner",
  thumbnail: "Thumbnail",
};

const KIND_HINTS: Record<AssetKind, string> = {
  hero: "Wide 16:9 art for the top of a page, with room for a headline.",
  banner: "A panoramic strip that survives being cropped to a narrow band.",
  thumbnail: "A square image that still reads at card size.",
};

/** Matches the aspect the generator asks the model for, so the grid never lies. */
const KIND_ASPECT: Record<AssetKind, string> = {
  hero: "aspect-video",
  banner: "aspect-video",
  thumbnail: "aspect-square",
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

function formatDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, DATE_FORMAT);
}

/* ------------------------------------------------------------- kind picker */

function KindPicker({
  kinds,
  value,
  onChange,
  disabled,
}: {
  kinds: readonly AssetKind[];
  value: AssetKind;
  onChange: (kind: AssetKind) => void;
  disabled: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="field-label">Shape</legend>
      <div className="flex flex-wrap gap-2">
        {kinds.map((kind) => {
          const active = kind === value;
          return (
            <label
              key={kind}
              className={cn(
                "cursor-pointer rounded-md border px-3 py-1.5 text-[14px] font-medium tracking-[-0.02em] transition-colors",
                active
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-surface text-ink-soft hover:border-line-strong/50 hover:bg-canvas-deep hover:text-ink",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                type="radio"
                name="assetKind"
                value={kind}
                checked={active}
                onChange={() => onChange(kind)}
                className="sr-only"
              />
              {KIND_LABELS[kind]}
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-[13px] leading-5 text-ink-muted">{KIND_HINTS[value]}</p>
    </fieldset>
  );
}

/* ----------------------------------------------------------- copy-url button */

function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard access can be refused (insecure origin, denied permission).
      // Selecting the URL by hand still works, so this is not worth an alert.
      setCopied(false);
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={copy} className="w-full">
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {copied ? "Copied" : "Copy URL"}
    </Button>
  );
}

/* --------------------------------------------------------- place in site */

/** The `AssetTarget` an option row addresses — the picker's only translation. */
function targetFor(option: AssetTargetOption): AssetTarget {
  return option.kind === "hero"
    ? { kind: "hero", pageId: option.id }
    : { kind: "block", blockId: option.id };
}

/**
 * Pick a placement, press the button, the draft is saved. A native `<select>`
 * with two `<optgroup>`s: the platform's own listbox is keyboard- and
 * screen-reader-complete, and "no new dependency" is a hard rule.
 *
 * The selection is *derived*, never mirrored into state — an apply can add a
 * hero section, and the refreshed `targets` prop then rewrites the list
 * underneath this component.
 */
function PlaceInSite({
  siteId,
  url,
  targets,
}: {
  siteId: string;
  url: string;
  targets: AssetTargetOption[];
}) {
  const { toast } = useToast();
  const [chosen, setChosen] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const selected = targets.find((option) => option.id === chosen) ?? targets[0];
  const heroes = targets.filter((option) => option.kind === "hero");
  const blocks = targets.filter((option) => option.kind === "block");

  async function place() {
    if (!selected || pending) return;
    setPending(true);
    try {
      const result = await applyAsset(siteId, targetFor(selected), url);
      if (result.ok) toast(`Placed in ${selected.label}`);
      else toast(result.error, "error");
    } catch {
      toast("Couldn’t place that image. Please try again.", "error");
    } finally {
      setPending(false);
    }
  }

  if (targets.length === 0) {
    return (
      <p className="text-[12px] leading-4 text-ink-muted">
        This site&rsquo;s draft can&rsquo;t be read, so there is nowhere to place an image yet.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Where to place this image"
        className="field h-8 min-w-0 flex-1 py-0 text-[13px]"
        value={selected?.id ?? ""}
        onChange={(event) => setChosen(event.target.value)}
        disabled={pending}
      >
        <optgroup label="Page hero">
          {heroes.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </optgroup>
        {blocks.length > 0 && (
          <optgroup label="Image blocks">
            {blocks.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <Button type="button" size="sm" onClick={place} loading={pending} disabled={!selected}>
        {!pending && <ImagePlus className="size-4" aria-hidden />}
        Place
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ gallery */

function AssetCard({
  asset,
  siteId,
  targets,
}: {
  asset: AssetSummary;
  siteId: string;
  targets: AssetTargetOption[];
}) {
  return (
    <figure className="card overflow-hidden">
      <div className={cn("bg-canvas-deep", KIND_ASPECT[asset.assetKind])}>
        {/* eslint-disable-next-line @next/next/no-img-element -- blob-hosted art, rendered unoptimised like every other creator image */}
        <img
          src={asset.url}
          alt={asset.prompt || "Generated asset"}
          loading="lazy"
          className="size-full object-cover"
        />
      </div>
      <figcaption className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-full border border-line bg-canvas-deep px-2 py-0.5 text-[12px] font-medium tracking-[-0.01em] text-ink-soft">
            {KIND_LABELS[asset.assetKind]}
          </span>
          <time dateTime={asset.createdAt} className="text-[12px] text-ink-muted">
            {formatDate(asset.createdAt)}
          </time>
        </div>
        <p className="line-clamp-3 text-[13px] leading-5 tracking-[-0.01em] text-ink-soft">
          {asset.prompt || "No prompt recorded"}
        </p>
        <PlaceInSite siteId={siteId} url={asset.url} targets={targets} />
        <CopyUrlButton url={asset.url} />
      </figcaption>
    </figure>
  );
}

/* -------------------------------------------------------------------- panel */

export function AssetStudio({
  siteId,
  initialAssets,
  configured,
  kinds,
  promptMax,
  targets,
}: {
  siteId: string;
  initialAssets: AssetSummary[];
  configured: boolean;
  /** `ASSET_KINDS`, handed down so the SDK stays out of this bundle. */
  kinds: readonly AssetKind[];
  promptMax: number;
  /** `imageTargets(draft)`, computed on the server; empty when it will not parse. */
  targets: AssetTargetOption[];
}) {
  const [assets, setAssets] = React.useState(initialAssets);
  const [kind, setKind] = React.useState<AssetKind>(kinds[0] ?? "hero");
  const [prompt, setPrompt] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const trimmed = prompt.trim();

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !trimmed) return;

    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, kind, prompt: trimmed }),
      });
      const payload: { asset?: AssetSummary; error?: string } = await response.json().catch(() => ({}));

      if (!response.ok || !payload.asset) {
        setError(payload.error ?? "That didn’t work. Please try again.");
        return;
      }
      // Newest first, matching the order the route lists them in.
      setAssets((current) => [payload.asset as AssetSummary, ...current]);
      setPrompt("");
    } catch {
      setError("Couldn’t reach the generator. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    // `/studio` has no layout to hold a ToastProvider — and this branch does not
    // own one — so the panel mounts its own around the subtree that needs it
    // (docs/spikes/2026-09-03-asset-placement-targets.md, §5).
    <ToastProvider>
      <div className="space-y-8">
        {configured ? (
          <form onSubmit={generate} className="card space-y-5 p-6">
            <div>
              <h2 className="text-[16px] font-medium tracking-[-0.02em] text-ink">Generate an image</h2>
              <p className="mt-1 text-[13px] leading-5 text-ink-muted">
                Describe the subject and the mood. The generator handles the framing.
              </p>
            </div>

            <KindPicker kinds={kinds} value={kind} onChange={setKind} disabled={pending} />

            <div>
              <TextArea
                label="Prompt"
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  setError(null);
                }}
                maxLength={promptMax}
                disabled={pending}
                placeholder="A sunlit ceramics workshop, clay dust in the air, warm terracotta and off-white"
              />
              <p className="mt-1.5 text-right text-[12px] text-ink-muted">
                {trimmed.length} / {promptMax}
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-md border border-danger/25 bg-danger-soft px-4 py-3"
              >
                <TriangleAlert className="mt-px size-4 shrink-0 text-danger-deep" aria-hidden />
                <p className="text-[14px] leading-5 tracking-[-0.02em] text-danger-deep">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] text-ink-muted">Takes about half a minute.</p>
              <Button type="submit" loading={pending} disabled={!trimmed}>
                {!pending && <Wand2 className="size-4" aria-hidden />}
                {pending ? "Generating…" : "Generate"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="card flex items-start gap-3 p-6">
            <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line bg-canvas text-ink-muted">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-[16px] font-medium tracking-[-0.02em] text-ink">Image generation isn’t configured</h2>
              <p className="mt-1 max-w-xl text-[14px] leading-5 tracking-[-0.02em] text-ink-soft">
                Add an <code className="font-mono text-[13px]">AI_GATEWAY_API_KEY</code> to{" "}
                <code className="font-mono text-[13px]">.env.local</code> and restart the server. Anything already in
                this library stays available.
              </p>
            </div>
          </div>
        )}

        <section>
          <p className="eyebrow mb-3 uppercase">library · {assets.length}</p>
          {assets.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-canvas px-6 py-12 text-center">
              <Sparkles className="size-5 text-ink-muted" aria-hidden />
              <p className="mt-3 max-w-sm text-[14px] leading-5 tracking-[-0.02em] text-ink-soft">
                Nothing generated yet. The first hero you make will show up here, ready to drop into the site.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((asset) => (
                <AssetCard key={asset.id} asset={asset} siteId={siteId} targets={targets} />
              ))}
            </div>
          )}
        </section>
      </div>
    </ToastProvider>
  );
}
