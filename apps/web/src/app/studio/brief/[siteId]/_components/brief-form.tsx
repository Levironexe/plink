"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Plus, X } from "lucide-react";
import { Button } from "@plink/ui/button";
import { TextField, TextArea } from "@plink/ui/field";
import { cn } from "@plink/core/utils";
import { BRIEF_TONES, type BriefData } from "@plink/core/site-schema";
import { saveBrief, submitBrief } from "../../../actions";

const PAGE_OPTIONS = [
  { id: "bio", label: "Bio", blurb: "Who they are, links, socials" },
  { id: "shop", label: "Shop", blurb: "Products and offers" },
  { id: "blog", label: "Blog", blurb: "Posts and updates" },
] as const;

const TONE_LABELS: Record<BriefData["tone"], string> = {
  friendly: "Friendly",
  professional: "Professional",
  playful: "Playful",
  bold: "Bold",
  minimal: "Minimal",
};

/** `input[type=color]` needs a 7-char hex; expand shorthand like `#abc`. */
function toColorInput(hex: string): string {
  const match = /^#([0-9a-fA-F]{3})$/.exec(hex);
  if (match) return `#${[...match[1]].map((c) => c + c).join("")}`;
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#171717";
}

function SectionCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-6">
      <h2 className="text-[16px] font-medium tracking-[-0.02em] text-ink">{title}</h2>
      {hint && <p className="mt-1 text-[13px] leading-5 text-ink-muted">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function RepeaterRow({ onRemove, children }: { onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-line bg-canvas p-3">
      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">{children}</div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove row"
        className="mt-1 shrink-0 rounded-md p-1.5 text-ink-muted transition-colors hover:bg-canvas-deep hover:text-ink"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function AddRowButton({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick} disabled={disabled}>
      <Plus className="size-4" aria-hidden />
      {children}
    </Button>
  );
}

export function BriefForm({ siteId, initial, status }: { siteId: string; initial: BriefData; status: string }) {
  const router = useRouter();
  const [brief, setBrief] = React.useState<BriefData>(initial);
  const [message, setMessage] = React.useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = React.useTransition();
  const submitted = status === "submitted";

  function patch(update: Partial<BriefData>) {
    setBrief((b) => ({ ...b, ...update }));
    setMessage(null);
  }

  function save() {
    startTransition(async () => {
      const result = await saveBrief(siteId, brief);
      setMessage(result.ok ? { kind: "ok", text: "Draft saved" } : { kind: "err", text: result.error });
      if (result.ok) router.refresh();
    });
  }

  function submit() {
    startTransition(async () => {
      // Submit always captures the latest edits first.
      const saved = await saveBrief(siteId, brief);
      if (!saved.ok) {
        setMessage({ kind: "err", text: saved.error });
        return;
      }
      const result = await submitBrief(siteId);
      setMessage(result.ok ? { kind: "ok", text: "Brief submitted" } : { kind: "err", text: result.error });
      if (result.ok) router.refresh();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-6"
    >
      {submitted && (
        <div className="flex items-start gap-2.5 rounded-md border border-brand-100 bg-brand-50 px-4 py-3">
          <CircleCheck className="mt-px size-4 shrink-0 text-brand-600" aria-hidden />
          <p className="text-[14px] leading-5 tracking-[-0.02em] text-brand-700">
            This brief has been submitted and is ready for the site build. Saving further edits returns it to draft.
          </p>
        </div>
      )}

      <SectionCard title="Business" hint="The essentials the whole site is built around.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Business name"
            value={brief.businessName}
            onChange={(e) => patch({ businessName: e.target.value })}
            maxLength={120}
            placeholder="e.g. Marta Ceramics"
          />
          <TextField
            label="Category"
            value={brief.category}
            onChange={(e) => patch({ category: e.target.value })}
            maxLength={60}
            placeholder="e.g. Ceramics studio"
          />
        </div>
        <TextField
          label="Tagline"
          value={brief.tagline}
          onChange={(e) => patch({ tagline: e.target.value })}
          maxLength={200}
          placeholder="One line that captures the business"
        />
        <TextArea
          label="Description"
          value={brief.description}
          onChange={(e) => patch({ description: e.target.value })}
          maxLength={2000}
          rows={5}
          placeholder="What they do, who it's for, what makes it different…"
        />
        <div>
          <label htmlFor="brief-tone" className="field-label">
            Tone of voice
          </label>
          <select
            id="brief-tone"
            className="field"
            value={brief.tone}
            onChange={(e) => patch({ tone: e.target.value as BriefData["tone"] })}
          >
            {BRIEF_TONES.map((tone) => (
              <option key={tone} value={tone}>
                {TONE_LABELS[tone]}
              </option>
            ))}
          </select>
        </div>
      </SectionCard>

      <SectionCard title="Pages" hint="Which pages should the site include?">
        <div className="grid gap-2 sm:grid-cols-3">
          {PAGE_OPTIONS.map((option) => {
            const checked = brief.pages.includes(option.id);
            return (
              <label
                key={option.id}
                className={cn(
                  "cursor-pointer rounded-md border p-3 transition-colors",
                  checked ? "border-ink shadow-[0_0_0_1px_var(--color-ink)]" : "border-line hover:border-line-strong/50",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    patch({
                      pages: checked
                        ? brief.pages.filter((p) => p !== option.id)
                        : [...brief.pages, option.id],
                    })
                  }
                  className="sr-only"
                />
                <span className="block text-[14px] font-medium tracking-[-0.02em] text-ink">{option.label}</span>
                <span className="mt-1 block text-[12px] leading-4 text-ink-muted">{option.blurb}</span>
              </label>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Products" hint="Up to 20 — enough for the shop page's first draft.">
        {brief.products.map((product, i) => (
          <RepeaterRow key={i} onRemove={() => patch({ products: brief.products.filter((_, j) => j !== i) })}>
            <TextField
              label="Name"
              value={product.name}
              onChange={(e) =>
                patch({ products: brief.products.map((p, j) => (j === i ? { ...p, name: e.target.value } : p)) })
              }
              maxLength={120}
            />
            <TextField
              label="Price"
              value={product.price}
              onChange={(e) =>
                patch({ products: brief.products.map((p, j) => (j === i ? { ...p, price: e.target.value } : p)) })
              }
              maxLength={30}
              placeholder="e.g. $24"
            />
            <div className="sm:col-span-2">
              <TextField
                label="Description"
                value={product.description}
                onChange={(e) =>
                  patch({
                    products: brief.products.map((p, j) => (j === i ? { ...p, description: e.target.value } : p)),
                  })
                }
                maxLength={500}
              />
            </div>
          </RepeaterRow>
        ))}
        <AddRowButton
          onClick={() => patch({ products: [...brief.products, { name: "", price: "", description: "" }] })}
          disabled={brief.products.length >= 20}
        >
          Add product
        </AddRowButton>
      </SectionCard>

      <SectionCard title="Links" hint="Important destinations — booking, press, newsletter…">
        {brief.links.map((link, i) => (
          <RepeaterRow key={i} onRemove={() => patch({ links: brief.links.filter((_, j) => j !== i) })}>
            <TextField
              label="Label"
              value={link.label}
              onChange={(e) =>
                patch({ links: brief.links.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)) })
              }
              maxLength={80}
            />
            <TextField
              label="URL"
              value={link.url}
              onChange={(e) => patch({ links: brief.links.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)) })}
              maxLength={2000}
              placeholder="https://…"
            />
          </RepeaterRow>
        ))}
        <AddRowButton
          onClick={() => patch({ links: [...brief.links, { label: "", url: "" }] })}
          disabled={brief.links.length >= 20}
        >
          Add link
        </AddRowButton>
      </SectionCard>

      <SectionCard title="Socials" hint="Where the client already has an audience.">
        {brief.socials.map((social, i) => (
          <RepeaterRow key={i} onRemove={() => patch({ socials: brief.socials.filter((_, j) => j !== i) })}>
            <TextField
              label="Platform"
              value={social.platform}
              onChange={(e) =>
                patch({ socials: brief.socials.map((s, j) => (j === i ? { ...s, platform: e.target.value } : s)) })
              }
              maxLength={30}
              placeholder="e.g. instagram"
            />
            <TextField
              label="URL"
              value={social.url}
              onChange={(e) =>
                patch({ socials: brief.socials.map((s, j) => (j === i ? { ...s, url: e.target.value } : s)) })
              }
              maxLength={2000}
              placeholder="https://…"
            />
          </RepeaterRow>
        ))}
        <AddRowButton
          onClick={() => patch({ socials: [...brief.socials, { platform: "", url: "" }] })}
          disabled={brief.socials.length >= 10}
        >
          Add social
        </AddRowButton>
      </SectionCard>

      <SectionCard title="Brand & contact" hint="Colors seed the theme; the email lands on the contact section.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="brief-color-primary" className="field-label">
              Primary color
            </label>
            <div className="flex items-center gap-2">
              <input
                id="brief-color-primary"
                type="color"
                value={toColorInput(brief.brandColors.primary)}
                onChange={(e) => patch({ brandColors: { ...brief.brandColors, primary: e.target.value } })}
                className="h-9 w-12 cursor-pointer rounded-md border border-line bg-surface p-1"
              />
              <code className="eyebrow">{brief.brandColors.primary}</code>
            </div>
          </div>
          <div>
            <label htmlFor="brief-color-accent" className="field-label">
              Accent color
            </label>
            <div className="flex items-center gap-2">
              <input
                id="brief-color-accent"
                type="color"
                value={toColorInput(brief.brandColors.accent)}
                onChange={(e) => patch({ brandColors: { ...brief.brandColors, accent: e.target.value } })}
                className="h-9 w-12 cursor-pointer rounded-md border border-line bg-surface p-1"
              />
              <code className="eyebrow">{brief.brandColors.accent}</code>
            </div>
          </div>
        </div>
        <TextField
          label="Contact email"
          type="email"
          value={brief.contactEmail}
          onChange={(e) => patch({ contactEmail: e.target.value })}
          maxLength={200}
          placeholder="hello@client.com"
        />
      </SectionCard>

      <div className="sticky bottom-0 -mx-2 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-canvas/95 px-2 py-4 backdrop-blur-sm">
        {message && (
          <p
            role="status"
            className={cn("mr-auto text-[13px] tracking-[-0.01em]", message.kind === "ok" ? "text-ink-soft" : "text-danger")}
          >
            {message.text}
          </p>
        )}
        <Button type="submit" variant="secondary" loading={pending}>
          Save draft
        </Button>
        <Button type="button" onClick={submit} loading={pending}>
          {submitted ? "Resubmit brief" : "Submit brief"}
        </Button>
      </div>
    </form>
  );
}
