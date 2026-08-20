"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@plink/ui/button";
import { TextArea, TextField, Toggle } from "@plink/ui/field";
import { PageHeader } from "../../_components/page-header";
import { useToast } from "@plink/ui/toast";
import { useDebouncedSave } from "@/lib/hooks";
import { updateMediaKit } from "@/app/dashboard/actions";
import { DEFAULT_DELIVERABLES, type MediaKitShape } from "@plink/core/media-kit";
import { formatMoney } from "@plink/core/utils";

export function MediaKitEditor({
  initial,
  username,
  displayName,
  isPro,
}: {
  initial: MediaKitShape;
  username: string;
  displayName: string;
  isPro: boolean;
}) {
  const { toast } = useToast();
  const [kit, setKit] = React.useState<MediaKitShape>(initial);

  const save = useDebouncedSave<MediaKitShape>(async (value) => {
    const res = await updateMediaKit({
      headline: value.headline,
      about: value.about,
      rateCard: JSON.stringify(value.rateCard),
      audience: JSON.stringify(value.audience),
      brands: JSON.stringify(value.brands),
      published: value.published,
    });
    if (!res.ok) toast(res.error, "error");
  });

  function patch(next: Partial<MediaKitShape>) {
    setKit((prev) => {
      const merged = { ...prev, ...next };
      save.schedule(merged);
      return merged;
    });
  }

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 sm:px-6 lg:py-10">
      <PageHeader
        title="Media kit"
        description="A link you can send a brand instead of rebuilding a PDF every time."
        actions={
          kit.published ? (
            <Link
              href={`/${username}/media-kit`}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-[14px] border border-line-strong bg-surface px-4 py-2.5 text-[14px] font-semibold text-ink transition hover:border-ink"
            >
              View live <ExternalLink className="size-4" />
            </Link>
          ) : null
        }
      />

      <div className="mt-8 flex flex-col gap-5">
        <Panel title="Publishing">
          <div className={isPro ? "" : "rounded-2xl border border-brand-200 bg-brand-50 p-4"}>
            <Toggle
              checked={kit.published}
              disabled={!isPro}
              onChange={(v) => patch({ published: v })}
              label="Publish my media kit"
              description={
                isPro
                  ? `Live at plink.to/${username}/media-kit`
                  : "Media kits are a Pro feature. Upgrade in Settings to publish yours."
              }
            />
          </div>
        </Panel>

        <Panel title="Intro">
          <div className="flex flex-col gap-4">
            <TextField
              label="Headline"
              value={kit.headline}
              onChange={(e) => patch({ headline: e.target.value })}
              placeholder={`${displayName} — design & tech creator`}
              maxLength={160}
            />
            <TextArea
              label="About"
              value={kit.about}
              onChange={(e) => patch({ about: e.target.value })}
              placeholder="Two or three sentences on who you make things for and what a partnership looks like."
              rows={4}
              maxLength={1200}
            />
          </div>
        </Panel>

        <Panel title="Audience" description="The numbers a brand asks for first.">
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ["followers", "Total followers", "284k"],
                ["reach", "Avg. reach / post", "96k"],
                ["engagement", "Engagement rate", "7.4%"],
                ["ageRange", "Core age range", "24–34"],
                ["splitFemale", "Audience split", "62% female"],
                ["topCountries", "Top countries", "US, UK, DE"],
              ] as const
            ).map(([key, label, placeholder]) => (
              <TextField
                key={key}
                label={label}
                value={kit.audience[key] ?? ""}
                onChange={(e) => patch({ audience: { ...kit.audience, [key]: e.target.value } })}
                placeholder={placeholder}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Rate card" description="What each deliverable costs. Leave it empty to keep pricing off the page.">
          <div className="flex flex-col gap-3">
            {kit.rateCard.map((item, i) => (
              <div key={i} className="flex items-end gap-2 rounded-2xl border border-line bg-canvas p-3">
                <div className="grid flex-1 gap-3 sm:grid-cols-[2fr_1fr]">
                  <TextField
                    label={i === 0 ? "Deliverable" : undefined}
                    value={item.deliverable}
                    onChange={(e) => {
                      const next = [...kit.rateCard];
                      next[i] = { ...item, deliverable: e.target.value };
                      patch({ rateCard: next });
                    }}
                    placeholder="Instagram Reel"
                    list="deliverables"
                  />
                  <TextField
                    label={i === 0 ? "Price (USD)" : undefined}
                    type="number"
                    min={0}
                    value={item.priceCents ? item.priceCents / 100 : ""}
                    onChange={(e) => {
                      const next = [...kit.rateCard];
                      next[i] = { ...item, priceCents: Math.max(0, Math.round(Number(e.target.value) * 100) || 0) };
                      patch({ rateCard: next });
                    }}
                    placeholder="3200"
                  />
                </div>
                <button
                  onClick={() => patch({ rateCard: kit.rateCard.filter((_, k) => k !== i) })}
                  aria-label={`Remove ${item.deliverable || "row"}`}
                  className="mb-1 rounded-lg p-2 text-ink-muted transition hover:bg-canvas-deep hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <datalist id="deliverables">
              {DEFAULT_DELIVERABLES.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => patch({ rateCard: [...kit.rateCard, { deliverable: "", priceCents: 0 }] })}
            >
              <Plus className="size-4" /> Add a line
            </Button>
          </div>

          {kit.rateCard.length > 0 && (
            <p className="mt-4 text-[13.5px] text-ink-muted">
              Full package total:{" "}
              <strong className="font-bold text-ink">
                {formatMoney(kit.rateCard.reduce((s, r) => s + (r.priceCents || 0), 0))}
              </strong>
            </p>
          )}
        </Panel>

        <Panel title="Brands you've worked with">
          <BrandEditor brands={kit.brands} onChange={(brands) => patch({ brands })} />
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-soft sm:p-6">
      <h2 className="text-[17px] font-bold text-ink">{title}</h2>
      {description && <p className="mt-1 text-[14px] text-ink-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function BrandEditor({ brands, onChange }: { brands: string[]; onChange: (b: string[]) => void }) {
  const [value, setValue] = React.useState("");

  function add(e: React.FormEvent) {
    e.preventDefault();
    const clean = value.trim();
    if (!clean || brands.includes(clean)) return;
    onChange([...brands, clean]);
    setValue("");
  }

  return (
    <div>
      {brands.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {brands.map((b) => (
            <li key={b}>
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas py-1.5 pr-1.5 pl-3.5 text-[13.5px] font-semibold text-ink">
                {b}
                <button
                  onClick={() => onChange(brands.filter((x) => x !== b))}
                  aria-label={`Remove ${b}`}
                  className="grid size-6 place-items-center rounded-full text-ink-muted transition hover:bg-black/10 hover:text-danger"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Figma"
          aria-label="Brand name"
          className="field flex-1"
        />
        <Button type="submit" variant="outline">Add</Button>
      </form>
    </div>
  );
}
