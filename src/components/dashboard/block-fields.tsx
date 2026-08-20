"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { TextArea, TextField, Toggle } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { parseConfig } from "@/lib/blocks";
import type { EditorBlock } from "./types";

type Patch = Partial<EditorBlock>;

export function BlockFields({
  block,
  onChange,
}: {
  block: EditorBlock;
  onChange: (patch: Patch) => void;
}) {
  const setConfig = (next: Record<string, unknown>) =>
    onChange({ config: JSON.stringify({ ...parseConfig(block.config), ...next }) });

  switch (block.type) {
    case "header":
      return (
        <TextField
          label="Section title"
          value={block.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Latest drops"
        />
      );

    case "text":
      return (
        <div className="flex flex-col gap-4">
          <TextField
            label="Heading (optional)"
            value={block.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="A note"
          />
          <TextArea
            label="Body"
            value={block.subtitle}
            onChange={(e) => onChange({ subtitle: e.target.value })}
            placeholder="Tell your audience something."
            rows={3}
          />
        </div>
      );

    case "divider":
      return <p className="text-[14px] text-ink-muted">A divider has no settings — drag it where you need space.</p>;

    case "socials":
      return (
        <p className="text-[14px] text-ink-muted">
          This block shows the social icons you set up in the profile panel above.
        </p>
      );

    case "image":
      return (
        <div className="flex flex-col gap-4">
          <TextField
            label="Image URL"
            value={block.imageUrl ?? ""}
            onChange={(e) => onChange({ imageUrl: e.target.value })}
            placeholder="https://…/photo.jpg"
            hint="Paste a link to any image on the web."
          />
          <TextField
            label="Caption (optional)"
            value={block.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Behind the scenes"
          />
          <TextField
            label="Links to (optional)"
            value={block.url}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://…"
          />
        </div>
      );

    case "video":
    case "music":
      return (
        <div className="flex flex-col gap-4">
          <TextField
            label={block.type === "video" ? "YouTube or Vimeo link" : "Spotify or SoundCloud link"}
            value={block.url}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder={block.type === "video" ? "https://youtube.com/watch?v=…" : "https://open.spotify.com/…"}
            hint="Anything else falls back to a normal button."
          />
          <TextField
            label="Label (optional)"
            value={block.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Latest release"
          />
        </div>
      );

    case "email": {
      const cfg = parseConfig<{ buttonLabel?: string; placeholder?: string }>(block.config);
      return (
        <div className="flex flex-col gap-4">
          <TextField
            label="Headline"
            value={block.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Join my newsletter"
          />
          <TextField
            label="Sub-line"
            value={block.subtitle}
            onChange={(e) => onChange({ subtitle: e.target.value })}
            placeholder="Weekly drops, no spam."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Button label"
              value={cfg.buttonLabel ?? ""}
              onChange={(e) => setConfig({ buttonLabel: e.target.value })}
              placeholder="Subscribe"
            />
            <TextField
              label="Input placeholder"
              value={cfg.placeholder ?? ""}
              onChange={(e) => setConfig({ placeholder: e.target.value })}
              placeholder="you@email.com"
            />
          </div>
        </div>
      );
    }

    case "tipjar": {
      const cfg = parseConfig<{ amounts?: number[] }>(block.config);
      const amounts = cfg.amounts ?? [3, 5, 10];
      return (
        <div className="flex flex-col gap-4">
          <TextField
            label="Headline"
            value={block.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Buy me a coffee"
          />
          <TextField
            label="Sub-line"
            value={block.subtitle}
            onChange={(e) => onChange({ subtitle: e.target.value })}
            placeholder="Support the work"
          />
          <div>
            <span className="field-label">Suggested amounts (USD)</span>
            <div className="flex gap-2">
              {amounts.map((a, i) => (
                <input
                  key={i}
                  type="number"
                  min={1}
                  max={1000}
                  value={a}
                  aria-label={`Amount ${i + 1}`}
                  onChange={(e) => {
                    const next = [...amounts];
                    next[i] = Math.max(1, Number(e.target.value) || 1);
                    setConfig({ amounts: next });
                  }}
                  className="field w-24"
                />
              ))}
            </div>
          </div>
        </div>
      );
    }

    case "faq": {
      const cfg = parseConfig<{ items?: { q: string; a: string }[] }>(block.config);
      const items = cfg.items ?? [];
      return (
        <div className="flex flex-col gap-4">
          <TextField
            label="Section title"
            value={block.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="FAQ"
          />
          <div className="flex flex-col gap-3">
            {items.map((item, i) => (
              <div key={i} className="rounded-2xl border border-line bg-canvas p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <input
                      value={item.q}
                      onChange={(e) => {
                        const next = [...items];
                        next[i] = { ...item, q: e.target.value };
                        setConfig({ items: next });
                      }}
                      placeholder="Question"
                      aria-label={`Question ${i + 1}`}
                      className="field"
                    />
                    <textarea
                      value={item.a}
                      onChange={(e) => {
                        const next = [...items];
                        next[i] = { ...item, a: e.target.value };
                        setConfig({ items: next });
                      }}
                      placeholder="Answer"
                      aria-label={`Answer ${i + 1}`}
                      rows={2}
                      className="field resize-y"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfig({ items: items.filter((_, k) => k !== i) })}
                    aria-label={`Remove question ${i + 1}`}
                    className="rounded-lg p-2 text-ink-muted transition hover:bg-black/5 hover:text-coral"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfig({ items: [...items, { q: "", a: "" }] })}
          >
            <Plus className="size-4" /> Add question
          </Button>
        </div>
      );
    }

    case "gallery": {
      const cfg = parseConfig<{ items?: { imageUrl: string; url?: string; caption?: string }[] }>(block.config);
      const items = cfg.items ?? [];
      return (
        <div className="flex flex-col gap-4">
          <TextField
            label="Section title"
            value={block.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Recent work"
          />
          <div className="flex flex-col gap-2.5">
            {items.map((item, i) => (
              <div key={i} className="flex items-start gap-2 rounded-2xl border border-line bg-canvas p-3">
                <div className="grid flex-1 gap-2 sm:grid-cols-3">
                  <input
                    value={item.imageUrl}
                    onChange={(e) => {
                      const next = [...items];
                      next[i] = { ...item, imageUrl: e.target.value };
                      setConfig({ items: next });
                    }}
                    placeholder="Image URL"
                    aria-label={`Image URL ${i + 1}`}
                    className="field"
                  />
                  <input
                    value={item.url ?? ""}
                    onChange={(e) => {
                      const next = [...items];
                      next[i] = { ...item, url: e.target.value };
                      setConfig({ items: next });
                    }}
                    placeholder="Links to"
                    aria-label={`Link ${i + 1}`}
                    className="field"
                  />
                  <input
                    value={item.caption ?? ""}
                    onChange={(e) => {
                      const next = [...items];
                      next[i] = { ...item, caption: e.target.value };
                      setConfig({ items: next });
                    }}
                    placeholder="Caption"
                    aria-label={`Caption ${i + 1}`}
                    className="field"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setConfig({ items: items.filter((_, k) => k !== i) })}
                  aria-label={`Remove image ${i + 1}`}
                  className="rounded-lg p-2 text-ink-muted transition hover:bg-black/5 hover:text-coral"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfig({ items: [...items, { imageUrl: "", url: "", caption: "" }] })}
          >
            <Plus className="size-4" /> Add image
          </Button>
        </div>
      );
    }

    case "product":
      return <ProductPicker block={block} onChange={onChange} />;

    default:
      return (
        <div className="flex flex-col gap-4">
          <TextField
            label="Label"
            value={block.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="My new link"
          />
          <TextField
            label="URL"
            value={block.url}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://example.com"
            inputMode="url"
          />
          <TextField
            label="Sub-line (optional)"
            value={block.subtitle}
            onChange={(e) => onChange({ subtitle: e.target.value })}
            placeholder="Closes Friday"
          />
          <TextField
            label="Thumbnail URL (optional)"
            value={block.imageUrl ?? ""}
            onChange={(e) => onChange({ imageUrl: e.target.value })}
            placeholder="https://…/icon.png"
          />
          <Toggle
            checked={block.highlight}
            onChange={(v) => onChange({ highlight: v })}
            label="Highlight this link"
            description="Adds an accent ring so it stands out."
          />
        </div>
      );
  }
}

function ProductPicker({ block, onChange }: { block: EditorBlock; onChange: (p: Patch) => void }) {
  const cfg = parseConfig<{ productId?: string }>(block.config);
  const products = useProducts();

  if (products === null) {
    return <p className="text-[14px] text-ink-muted">Loading your products…</p>;
  }
  if (products.length === 0) {
    return (
      <p className="text-[14px] text-ink-muted">
        You have no products yet. Add one in <strong className="font-semibold text-ink">Store</strong>, then come back
        and pick it here.
      </p>
    );
  }

  return (
    <div>
      <label className="field-label" htmlFor={`product-${block.id}`}>
        Which product?
      </label>
      <select
        id={`product-${block.id}`}
        className="field"
        value={cfg.productId ?? ""}
        onChange={(e) => onChange({ config: JSON.stringify({ ...cfg, productId: e.target.value }) })}
      >
        <option value="">Choose a product…</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function useProducts() {
  const [products, setProducts] = React.useState<{ id: string; name: string }[] | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    void fetch("/api/products")
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((data: { products: { id: string; name: string }[] }) => {
        if (!cancelled) setProducts(data.products ?? []);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return products;
}
