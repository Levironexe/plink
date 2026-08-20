"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@plink/ui/button";
import { TextArea, TextField } from "@plink/ui/field";
import { useToast } from "@plink/ui/toast";
import { PhoneFrame } from "@/components/profile/phone-frame";
import { ProfileView } from "@/components/profile/profile-view";
import { Logo } from "@/components/logo";
import { completeOnboarding } from "@/app/dashboard/actions";
import { THEME_PRESETS, presetToTheme } from "@plink/core/themes";
import { SOCIAL_PLATFORMS, socialPlatform } from "@plink/core/socials";
import { generatedAvatar } from "@plink/core/avatar";
import { cn, initialsOf } from "@plink/core/utils";
import type { PublicProfile } from "@plink/core/profile-types";

const CATEGORIES = [
  "Creator", "Musician", "Designer", "Coach", "Writer", "Photographer",
  "Developer", "Studio", "Podcaster", "Chef", "Athlete", "Artist",
];

const STEPS = ["You", "Links", "Socials", "Look"] as const;

export function OnboardingFlow({ username, userId }: { username: string; userId: string }) {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = React.useState(0);
  const [displayName, setDisplayName] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState("");
  const [links, setLinks] = React.useState([{ title: "", url: "" }]);
  const [socials, setSocials] = React.useState<{ platform: string; url: string }[]>([]);
  const [presetId, setPresetId] = React.useState(THEME_PRESETS[0].id);
  const [saving, setSaving] = React.useState(false);

  const preview: PublicProfile = React.useMemo(() => {
    const preset = THEME_PRESETS.find((p) => p.id === presetId) ?? THEME_PRESETS[0];
    const cleanLinks = links.filter((l) => l.title.trim());
    const cleanSocials = socials.filter((s) => s.url.trim());
    return {
      id: userId,
      username,
      displayName: displayName || username,
      bio,
      avatarUrl: avatarUrl || generatedAvatar(username, initialsOf(displayName || username)),
      bannerUrl: null,
      verified: false,
      category: category || null,
      location: null,
      theme: presetToTheme(preset),
      blocks: [
        ...cleanLinks.map((l, i) => ({
          id: `preview-link-${i}`,
          type: "link",
          title: l.title,
          subtitle: "",
          url: l.url,
          imageUrl: null,
          config: "{}",
          visible: true,
          highlight: false,
        })),
        ...(cleanSocials.length
          ? [{
              id: "preview-socials",
              type: "socials",
              title: "",
              subtitle: "",
              url: "",
              imageUrl: null,
              config: "{}",
              visible: true,
              highlight: false,
            }]
          : []),
      ],
      socials: cleanSocials.map((s, i) => ({
        id: `preview-social-${i}`,
        platform: s.platform,
        url: socialPlatform(s.platform)?.toUrl(s.url) ?? s.url,
      })),
      products: [],
    };
  }, [userId, username, displayName, bio, category, avatarUrl, links, socials, presetId]);

  const canContinue = step === 0 ? displayName.trim().length > 0 : true;

  async function finish() {
    setSaving(true);
    try {
      const res = await completeOnboarding({
        displayName: displayName.trim() || username,
        bio: bio.trim(),
        category: category || null,
        avatarUrl: avatarUrl.trim() || null,
        presetId,
        links: links.filter((l) => l.title.trim() && l.url.trim()),
        socials: socials.filter((s) => s.url.trim()),
      });
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Logo />

        <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center py-10">
          <ol className="flex items-center gap-2" aria-label="Progress">
            {STEPS.map((label, i) => (
              <li key={label} className="flex flex-1 items-center gap-2">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full text-[12.5px] font-bold transition",
                    i < step ? "bg-brand-500 text-white" : i === step ? "bg-ink text-white" : "bg-black/5 text-ink-muted",
                  )}
                >
                  {i < step ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                {i < STEPS.length - 1 && (
                  <span className={cn("h-0.5 flex-1 rounded-full transition", i < step ? "bg-brand-500" : "bg-black/8")} />
                )}
              </li>
            ))}
          </ol>

          <div className="mt-10">
            {step === 0 && (
              <section>
                <h1 className="text-[30px] leading-tight font-semibold text-ink">Tell us who you are</h1>
                <p className="mt-2 text-[15.5px] text-ink-muted">This is the top of your page. You can change it later.</p>
                <div className="mt-7 flex flex-col gap-4">
                  <TextField
                    label="Display name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Maya Osei"
                    autoFocus
                    maxLength={60}
                  />
                  <TextArea
                    label="Bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Product designer turned indie maker."
                    rows={2}
                    maxLength={300}
                  />
                  <div>
                    <span className="field-label">What do you do?</span>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCategory(category === c ? "" : c)}
                          aria-pressed={category === c}
                          className={cn(
                            "rounded-full border px-3.5 py-2 text-[13.5px] font-semibold transition",
                            category === c ? "border-ink bg-ink text-white" : "border-line text-ink-muted hover:text-ink",
                          )}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <TextField
                    label="Avatar URL (optional)"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://…/avatar.jpg"
                    hint="Skip it and we’ll generate one for you."
                  />
                </div>
              </section>
            )}

            {step === 1 && (
              <section>
                <h1 className="text-[30px] leading-tight font-semibold text-ink">Add your first links</h1>
                <p className="mt-2 text-[15.5px] text-ink-muted">
                  Your shop, your latest video, your portfolio — whatever people ask for most.
                </p>
                <div className="mt-7 flex flex-col gap-3">
                  {links.map((link, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-2xl border border-line bg-surface p-3">
                      <div className="grid flex-1 gap-2.5">
                        <input
                          value={link.title}
                          onChange={(e) => {
                            const next = [...links];
                            next[i] = { ...link, title: e.target.value };
                            setLinks(next);
                          }}
                          placeholder="Label — e.g. My portfolio"
                          aria-label={`Link ${i + 1} label`}
                          className="field"
                        />
                        <input
                          value={link.url}
                          onChange={(e) => {
                            const next = [...links];
                            next[i] = { ...link, url: e.target.value };
                            setLinks(next);
                          }}
                          placeholder="https://example.com"
                          aria-label={`Link ${i + 1} URL`}
                          inputMode="url"
                          className="field"
                        />
                      </div>
                      {links.length > 1 && (
                        <button
                          onClick={() => setLinks(links.filter((_, k) => k !== i))}
                          aria-label={`Remove link ${i + 1}`}
                          className="rounded-lg p-2 text-ink-muted transition hover:bg-canvas-deep hover:text-danger"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {links.length < 8 && (
                    <Button
                      variant="outline"
                      className="self-start"
                      onClick={() => setLinks([...links, { title: "", url: "" }])}
                    >
                      <Plus className="size-4" /> Add another
                    </Button>
                  )}
                </div>
              </section>
            )}

            {step === 2 && (
              <section>
                <h1 className="text-[30px] leading-tight font-semibold text-ink">Where else are you?</h1>
                <p className="mt-2 text-[15.5px] text-ink-muted">Tap a platform, then drop in your handle.</p>
                <div className="mt-7 flex flex-wrap gap-2">
                  {SOCIAL_PLATFORMS.map((p) => {
                    const active = socials.some((s) => s.platform === p.id);
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.id}
                        onClick={() =>
                          setSocials((prev) =>
                            active ? prev.filter((s) => s.platform !== p.id) : [...prev, { platform: p.id, url: "" }],
                          )
                        }
                        aria-pressed={active}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13.5px] font-semibold transition",
                          active ? "border-ink bg-ink text-white" : "border-line text-ink-soft hover:text-ink",
                        )}
                      >
                        <Icon width={15} height={15} />
                        {p.name}
                      </button>
                    );
                  })}
                </div>

                {socials.length > 0 && (
                  <div className="mt-6 flex flex-col gap-2.5">
                    {socials.map((s, i) => {
                      const p = socialPlatform(s.platform)!;
                      const Icon = p.icon;
                      return (
                        <div key={s.platform} className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface p-2.5">
                          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-canvas" style={{ color: p.color }}>
                            <Icon width={17} height={17} />
                          </span>
                          <input
                            value={s.url}
                            onChange={(e) => {
                              const next = [...socials];
                              next[i] = { ...s, url: e.target.value };
                              setSocials(next);
                            }}
                            placeholder={p.placeholder}
                            aria-label={`${p.name} handle`}
                            className="field"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {step === 3 && (
              <section>
                <h1 className="text-[30px] leading-tight font-semibold text-ink">Pick a look</h1>
                <p className="mt-2 text-[15.5px] text-ink-muted">Every colour is editable later.</p>
                <div className="mt-7 grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {THEME_PRESETS.map((t) => {
                    const active = presetId === t.id;
                    const v = t.values;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setPresetId(t.id)}
                        aria-pressed={active}
                        className={cn(
                          "overflow-hidden rounded-[16px] border-2 transition hover:-translate-y-0.5",
                          active ? "border-ink" : "border-transparent hover:border-line-strong",
                        )}
                      >
                        <div
                          className="flex h-24 flex-col items-center gap-1.5 pt-3"
                          style={{
                            backgroundImage:
                              v.bgType === "gradient" ? `linear-gradient(160deg, ${v.bgColor}, ${v.bgColorTwo})` : undefined,
                            backgroundColor: v.bgType !== "gradient" ? v.bgColor : undefined,
                          }}
                        >
                          <span className="size-5 rounded-full" style={{ background: v.textColor, opacity: 0.9 }} />
                          <span className="h-1 w-8 rounded-full" style={{ background: v.textColor, opacity: 0.5 }} />
                          <span
                            className="mt-1 h-3.5 w-[80%]"
                            style={{
                              background: v.buttonStyle === "outline" ? "transparent" : v.buttonColor,
                              border: v.buttonStyle === "outline" ? `1.5px solid ${v.buttonColor}` : undefined,
                              borderRadius: v.buttonRadius === "full" ? "999px" : v.buttonRadius === "none" ? "0" : "5px",
                            }}
                          />
                        </div>
                        <span className="block bg-surface py-2 text-[12px] font-bold text-ink">{t.name}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          <div className="mt-10 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className={step === 0 ? "invisible" : ""}
            >
              <ArrowLeft className="size-4" /> Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button size="lg" onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
                Continue <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button size="lg" onClick={finish} loading={saving}>
                Publish my page <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <aside className="relative hidden items-center justify-center bg-ink lg:flex">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 -left-16 size-[420px] rounded-full bg-brand-600/40 blur-[120px]" />
          <div className="absolute -right-20 bottom-0 size-[360px] rounded-full bg-danger/20 blur-[120px]" />
        </div>
        <div className="relative flex flex-col items-center gap-6">
          <p className="text-[13px] font-bold tracking-wider text-white/50 uppercase">Live preview</p>
          <PhoneFrame className="w-[280px] max-w-none">
            <ProfileView profile={preview} preview />
          </PhoneFrame>
          <p className="text-[14px] font-semibold text-white/60">plink.to/{username}</p>
        </div>
      </aside>
    </div>
  );
}
