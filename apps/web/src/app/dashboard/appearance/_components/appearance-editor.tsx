"use client";

import * as React from "react";
import { Check, Crown, Sparkles } from "lucide-react";
import {
  BG_PATTERNS, BUTTON_RADII, BUTTON_STYLES, FONT_OPTIONS, THEME_PRESETS,
  buttonCss, presetToTheme, radiusCss, type ThemeShape,
} from "@plink/core/themes";
import { PageHeader } from "../../_components/page-header";
import { ColorField } from "./color-field";
import { LivePreview, MobilePreviewSheet } from "../../_components/live-preview";
import { Toggle } from "@plink/ui/field";
import { ImageUpload } from "@plink/ui/image-upload";
import { useToast } from "@plink/ui/toast";
import { useDebouncedSave } from "@/lib/hooks";
import { updateTheme } from "@/app/dashboard/actions";
import { cn } from "@plink/core/utils";
import { EffectsTab } from "./effects-tab";
import type { EditorData } from "@plink/core/editor-types";
import type { PublicProfile } from "@plink/core/profile-types";

const TABS = [
  { id: "themes", label: "Themes" },
  { id: "background", label: "Background" },
  { id: "buttons", label: "Buttons" },
  { id: "effects", label: "Effects" },
  { id: "text", label: "Text & avatar" },
] as const;

export function AppearanceEditor({ initial }: { initial: EditorData }) {
  const { toast } = useToast();
  const [theme, setTheme] = React.useState<ThemeShape>(initial.theme);
  const [tab, setTab] = React.useState<(typeof TABS)[number]["id"]>("themes");

  const save = useDebouncedSave<ThemeShape>(async (value) => {
    const res = await updateTheme(value);
    if (!res.ok) toast(res.error, "error");
  }, 400);

  function patch(next: Partial<ThemeShape>) {
    setTheme((prev) => {
      const merged = { ...prev, ...next };
      save.schedule(merged);
      return merged;
    });
  }

  function applyPreset(presetId: string) {
    const preset = THEME_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const next = { ...presetToTheme(preset, theme.hideBranding) };
    setTheme(next);
    save.schedule(next);
    toast(`${preset.name} applied`);
  }

  const previewProfile: PublicProfile = React.useMemo(
    () => ({
      id: initial.profile.id,
      username: initial.profile.username,
      displayName: initial.profile.displayName,
      bio: initial.profile.bio,
      avatarUrl: initial.profile.avatarUrl,
      bannerUrl: initial.profile.bannerUrl,
      verified: initial.profile.verified,
      category: initial.profile.category,
      location: initial.profile.location,
      theme,
      blocks: initial.blocks,
      socials: initial.socials,
      products: initial.products,
    }),
    [initial, theme],
  );

  const isPro = initial.profile.plan !== "free";

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-10">
      <PageHeader
        title="Appearance"
        description="Start from a theme, then change anything you like."
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="flex flex-wrap gap-1.5 rounded-2xl border border-line bg-surface p-1.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
                className={cn(
                  "flex-1 rounded-xl px-3 py-2.5 text-[14px] font-semibold whitespace-nowrap transition",
                  tab === t.id ? "bg-ink text-white" : "text-ink-muted hover:bg-canvas-deep hover:text-ink",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {tab === "themes" && <ThemesTab theme={theme} onApply={applyPreset} />}
            {tab === "background" && <BackgroundTab theme={theme} patch={patch} />}
            {tab === "buttons" && <ButtonsTab theme={theme} patch={patch} />}
          {tab === "effects" && <EffectsTab theme={theme} patch={patch} />}
            {tab === "text" && <TextTab theme={theme} patch={patch} isPro={isPro} />}
          </div>
        </div>

        <div className="hidden lg:block">
          <LivePreview profile={previewProfile} />
        </div>
      </div>

      <MobilePreviewSheet profile={previewProfile} />
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

function ThemesTab({ theme, onApply }: { theme: ThemeShape; onApply: (id: string) => void }) {
  const groups = ["Signature", "Minimal", "Bold", "Soft", "Dark"] as const;
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => {
        const presets = THEME_PRESETS.filter((p) => p.group === group);
        if (presets.length === 0) return null;
        return (
          <Panel key={group} title={group}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {presets.map((preset) => {
                const active = theme.presetId === preset.id;
                const v = preset.values;
                return (
                  <button
                    key={preset.id}
                    onClick={() => onApply(preset.id)}
                    aria-pressed={active}
                    className={cn(
                      "group overflow-hidden rounded-[18px] border-2 text-left transition hover:-translate-y-0.5",
                      active ? "border-ink shadow-soft" : "border-transparent hover:border-line-strong",
                    )}
                  >
                    <div
                      className="relative flex h-36 flex-col items-center gap-2 px-4 pt-5"
                      style={{
                        backgroundImage:
                          v.bgType === "gradient" ? `linear-gradient(160deg, ${v.bgColor}, ${v.bgColorTwo})` : undefined,
                        backgroundColor: v.bgType !== "gradient" ? v.bgColor : undefined,
                      }}
                    >
                      {active && (
                        <span className="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-ink text-white">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      )}
                      <div className="size-7 rounded-full" style={{ background: v.textColor, opacity: 0.9 }} />
                      <div className="h-1.5 w-12 rounded-full" style={{ background: v.textColor, opacity: 0.5 }} />
                      <div className="mt-1 w-full space-y-1.5">
                        {[0, 1].map((k) => (
                          <div
                            key={k}
                            className="h-4"
                            style={{
                              ...buttonCss({ ...v, presetId: preset.id, hideBranding: false } as ThemeShape),
                              borderRadius: radiusCss(v.buttonRadius),
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between bg-surface px-3 py-2.5">
                      <span className="text-[13.5px] font-bold text-ink">{preset.name}</span>
                      {active && <span className="text-[11.5px] font-bold text-brand-600">Active</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

function BackgroundTab({ theme, patch }: { theme: ThemeShape; patch: (p: Partial<ThemeShape>) => void }) {
  const types = [
    { id: "solid", label: "Solid" },
    { id: "gradient", label: "Gradient" },
    { id: "image", label: "Image" },
  ];
  return (
    <div className="flex flex-col gap-5">
      <Panel title="Background style">
        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <button
              key={t.id}
              onClick={() => patch({ bgType: t.id })}
              aria-pressed={theme.bgType === t.id}
              className={cn(
                "rounded-xl border px-4 py-2.5 text-[14px] font-semibold transition",
                theme.bgType === t.id ? "border-ink bg-ink text-white" : "border-line text-ink-muted hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <ColorField
            label={theme.bgType === "gradient" ? "Gradient start" : "Background colour"}
            value={theme.bgColor}
            onChange={(v) => patch({ bgColor: v })}
          />
          {theme.bgType === "gradient" && (
            <ColorField label="Gradient end" value={theme.bgColorTwo} onChange={(v) => patch({ bgColorTwo: v })} />
          )}
        </div>

        {theme.bgType === "image" && (
          <div className="mt-5">
            <ImageUpload
              label="Background image"
              kind="block"
              shape="wide"
              value={theme.bgImageUrl ?? ""}
              onChange={(url) => patch({ bgImageUrl: url })}
              hint="A dark overlay is added automatically so text stays readable."
            />
          </div>
        )}
      </Panel>

      <Panel title="Pattern overlay" description="A subtle texture on top of your background.">
        <div className="flex flex-wrap gap-2">
          {BG_PATTERNS.map((p) => (
            <button
              key={p.id}
              onClick={() => patch({ bgPattern: p.id })}
              aria-pressed={theme.bgPattern === p.id}
              className={cn(
                "rounded-xl border px-4 py-2.5 text-[14px] font-semibold transition",
                theme.bgPattern === p.id ? "border-ink bg-ink text-white" : "border-line text-ink-muted hover:text-ink",
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ButtonsTab({ theme, patch }: { theme: ThemeShape; patch: (p: Partial<ThemeShape>) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <Panel title="Button style">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {BUTTON_STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => patch({ buttonStyle: s.id })}
              aria-pressed={theme.buttonStyle === s.id}
              className={cn(
                "rounded-2xl border-2 p-3 transition",
                theme.buttonStyle === s.id ? "border-ink" : "border-transparent hover:border-line-strong",
              )}
            >
              <div
                className="grid h-9 place-items-center px-2 text-[11px] font-bold"
                style={{
                  ...buttonCss({ ...theme, buttonStyle: s.id }),
                }}
              >
                Aa
              </div>
              <p className="mt-2 text-[12.5px] font-semibold text-ink">{s.name}</p>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Corners">
        <div className="flex flex-wrap gap-2">
          {BUTTON_RADII.map((r) => (
            <button
              key={r.id}
              onClick={() => patch({ buttonRadius: r.id })}
              aria-pressed={theme.buttonRadius === r.id}
              className={cn(
                "flex items-center gap-2 border px-4 py-2.5 text-[14px] font-semibold transition",
                theme.buttonRadius === r.id ? "border-ink bg-ink text-white" : "border-line text-ink-muted hover:text-ink",
              )}
              style={{ borderRadius: r.css === "999px" ? "999px" : "12px" }}
            >
              <span className="size-4 border-2 border-current" style={{ borderRadius: r.css }} aria-hidden />
              {r.name}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Button colours">
        <div className="grid gap-5 sm:grid-cols-2">
          <ColorField label="Button fill / border" value={theme.buttonColor} onChange={(v) => patch({ buttonColor: v })} />
          <ColorField label="Button text" value={theme.buttonTextColor} onChange={(v) => patch({ buttonTextColor: v })} />
        </div>
      </Panel>
    </div>
  );
}

function TextTab({
  theme, patch, isPro,
}: {
  theme: ThemeShape;
  patch: (p: Partial<ThemeShape>) => void;
  isPro: boolean;
}) {
  const shapes = [
    { id: "circle", label: "Circle" },
    { id: "rounded", label: "Rounded" },
    { id: "square", label: "Square" },
  ];
  return (
    <div className="flex flex-col gap-5">
      <Panel title="Font">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.id}
              onClick={() => patch({ fontFamily: f.id })}
              aria-pressed={theme.fontFamily === f.id}
              className={cn(
                "rounded-2xl border-2 px-4 py-5 transition",
                theme.fontFamily === f.id ? "border-ink bg-canvas" : "border-line hover:border-line-strong",
              )}
            >
              <span className="block text-[22px] leading-none font-bold text-ink" style={{ fontFamily: f.stack }}>
                Ag
              </span>
              <span className="mt-2 block text-[12.5px] font-semibold text-ink-muted">{f.name}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Text colours">
        <div className="grid gap-5 sm:grid-cols-3">
          <ColorField label="Headings" value={theme.textColor} onChange={(v) => patch({ textColor: v })} />
          <ColorField label="Body text" value={theme.mutedColor} onChange={(v) => patch({ mutedColor: v })} />
          <ColorField label="Accent" value={theme.accentColor} onChange={(v) => patch({ accentColor: v })} hint="Used for badges, tip buttons and highlights." />
        </div>
      </Panel>

      <Panel title="Avatar shape">
        <div className="flex flex-wrap gap-3">
          {shapes.map((s) => (
            <button
              key={s.id}
              onClick={() => patch({ avatarShape: s.id })}
              aria-pressed={theme.avatarShape === s.id}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border-2 px-6 py-4 transition",
                theme.avatarShape === s.id ? "border-ink bg-canvas" : "border-line hover:border-line-strong",
              )}
            >
              <span
                className="size-9 bg-gradient-to-br from-brand-300 to-brand-600"
                style={{ borderRadius: s.id === "circle" ? "999px" : s.id === "rounded" ? "10px" : "0px" }}
                aria-hidden
              />
              <span className="text-[12.5px] font-semibold text-ink">{s.label}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Branding">
        <div className={cn("rounded-2xl border p-4", isPro ? "border-line" : "border-brand-200 bg-brand-50")}>
          <Toggle
            checked={theme.hideBranding}
            disabled={!isPro}
            onChange={(v) => patch({ hideBranding: v })}
            label="Hide the “Make your own Plink” badge"
            description={isPro ? "Your page, your footer." : "Available on Pro."}
          />
          {!isPro && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700">
              <Crown className="size-3.5 text-brand-500" aria-hidden />
              Upgrade to remove Plink branding
              <Sparkles className="size-3.5" aria-hidden />
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}
