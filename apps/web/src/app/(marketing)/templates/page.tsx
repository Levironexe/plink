import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ProfileView } from "@/components/profile/profile-view";
import { DEMO_PROFILES } from "@plink/core/demo-profiles";
import { THEME_PRESETS } from "@plink/core/themes";
import { SectionHeading } from "../_components/section";
import { Reveal } from "../_components/reveal";
import { BigCta } from "../_components/cta";
import { ButtonLink } from "@plink/ui/button";

export const metadata: Metadata = {
  title: "Templates",
  description: "Twelve designer-made themes and six ready-to-copy creator pages. Pick one and make it yours.",
};

export default function TemplatesPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pt-16 sm:pt-24">
        <SectionHeading
          eyebrow="Templates"
          title="Real pages, not screenshots"
          body="Every template below is a working Plink. Open one, see how it's built, then start from it."
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pt-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_PROFILES.map((profile, i) => (
            <Reveal key={profile.id} delay={i * 60}>
              <article className="group overflow-hidden rounded-xl border border-line bg-surface shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
                {/* The preview is absolutely positioned and sized in percentages so it
                    scales with the card instead of forcing the grid track wider. */}
                <div className="relative h-[420px] w-full overflow-hidden border-b border-line">
                  <div className="pointer-events-none absolute top-0 left-0 h-[200%] w-[200%] origin-top-left scale-50">
                    <ProfileView profile={profile} preview />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-[16px] font-bold text-ink">{profile.displayName}</h2>
                    <p className="truncate text-[13.5px] text-ink-muted">
                      {profile.category ?? "Creator"} · {profile.theme.presetId}
                    </p>
                  </div>
                  <Link
                    href={`/${profile.username}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-canvas px-3.5 py-2 text-[13px] font-bold text-ink transition group-hover:bg-ink group-hover:text-white"
                  >
                    Open
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pt-28">
        <SectionHeading
          eyebrow="Themes"
          title="Twelve starting points"
          body="Change any colour, font, button shape or background afterwards — themes are a starting point, not a cage."
        />
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {THEME_PRESETS.map((t, i) => (
            <Reveal key={t.id} delay={i * 40}>
              <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
                <div
                  className="flex h-52 flex-col items-center justify-center gap-2.5 px-6"
                  style={{
                    backgroundImage:
                      t.values.bgType === "gradient"
                        ? `linear-gradient(160deg, ${t.values.bgColor}, ${t.values.bgColorTwo})`
                        : undefined,
                    backgroundColor: t.values.bgType !== "gradient" ? t.values.bgColor : undefined,
                  }}
                >
                  <div className="size-10 rounded-full" style={{ background: t.values.textColor, opacity: 0.9 }} />
                  <div className="h-2 w-16 rounded-full" style={{ background: t.values.textColor, opacity: 0.5 }} />
                  <div className="mt-1 w-full space-y-2">
                    {[0, 1, 2].map((k) => (
                      <div
                        key={k}
                        className="h-6"
                        style={{
                          background: t.values.buttonStyle === "outline" ? "transparent" : t.values.buttonColor,
                          border: t.values.buttonStyle === "outline" ? `2px solid ${t.values.buttonColor}` : undefined,
                          borderRadius:
                            t.values.buttonRadius === "full" ? "999px" : t.values.buttonRadius === "none" ? "0" : "8px",
                          boxShadow: t.values.buttonStyle === "shadow" ? `3px 3px 0 0 ${t.values.textColor}` : undefined,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[14px] font-bold text-ink">{t.name}</span>
                  <span className="text-[12px] font-semibold text-ink-muted">{t.group}</span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-12 flex justify-center">
          <ButtonLink href="/signup" variant="ink" size="lg">
            Use a template
          </ButtonLink>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-28">
        <BigCta />
      </section>
    </>
  );
}
