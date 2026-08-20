import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { parseMediaKit } from "@/lib/media-kit";
import { generatedAvatar } from "@/lib/avatar";
import { formatMoney, initialsOf, isReservedUsername } from "@/lib/utils";
import { socialPlatform } from "@/lib/socials";
import { safeUrl } from "@/lib/utils";

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { displayName: true, username: true, mediaKit: { select: { published: true, headline: true } } },
  });
  if (!user?.mediaKit?.published) return { title: "Media kit not found", robots: { index: false } };
  return {
    title: `${user.displayName} — Media kit`,
    description: user.mediaKit.headline || `Partnership information for ${user.displayName}.`,
  };
}

export default async function PublicMediaKit({ params }: Params) {
  const { username } = await params;
  if (isReservedUsername(username)) notFound();

  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    include: { mediaKit: true, socials: { orderBy: { position: "asc" } } },
  });

  if (!user || !user.mediaKit?.published) notFound();

  const kit = parseMediaKit(user.mediaKit);
  const avatar = user.avatarUrl || generatedAvatar(user.username, initialsOf(user.displayName));
  const total = kit.rateCard.reduce((s, r) => s + (r.priceCents || 0), 0);

  const stats: [string, string | undefined][] = [
    ["Followers", kit.audience.followers],
    ["Avg. reach", kit.audience.reach],
    ["Engagement", kit.audience.engagement],
    ["Core age", kit.audience.ageRange],
    ["Split", kit.audience.splitFemale],
    ["Top markets", kit.audience.topCountries],
  ];
  const filledStats = stats.filter(([, v]) => v);

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-20">
        <Link
          href={`/${user.username}`}
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink-muted transition hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to @{user.username}
        </Link>

        <header className="mt-8 flex flex-wrap items-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatar} alt="" className="size-24 rounded-3xl object-cover" />
          <div className="min-w-0">
            <p className="text-[13px] font-bold tracking-wider text-brand-600 uppercase">Media kit</p>
            <h1 className="mt-1 text-[clamp(1.9rem,4.6vw,2.8rem)] leading-tight font-extrabold text-ink">
              {user.displayName}
            </h1>
            {kit.headline && <p className="mt-2 max-w-xl text-[17px] text-ink-soft">{kit.headline}</p>}
          </div>
        </header>

        {kit.about && (
          <section className="mt-10 rounded-[24px] border border-line bg-surface p-6 shadow-soft">
            <h2 className="text-[13px] font-bold tracking-wider text-ink-muted uppercase">About</h2>
            <p className="mt-3 text-[16.5px] leading-relaxed whitespace-pre-line text-ink-soft">{kit.about}</p>
          </section>
        )}

        {filledStats.length > 0 && (
          <section className="mt-6">
            <h2 className="text-[13px] font-bold tracking-wider text-ink-muted uppercase">Audience</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {filledStats.map(([label, value]) => (
                <div key={label} className="rounded-[20px] border border-line bg-surface p-4 shadow-soft">
                  <p className="text-[12.5px] font-semibold text-ink-muted">{label}</p>
                  <p className="mt-1 text-[22px] leading-tight font-extrabold text-ink">{value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {kit.rateCard.length > 0 && (
          <section className="mt-6">
            <h2 className="text-[13px] font-bold tracking-wider text-ink-muted uppercase">Rate card</h2>
            <div className="mt-3 divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-surface shadow-soft">
              {kit.rateCard
                .filter((r) => r.deliverable)
                .map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 px-5 py-4">
                    <span className="text-[16px] text-ink">{r.deliverable}</span>
                    <span className="shrink-0 text-[16px] font-bold text-ink">
                      {r.priceCents ? formatMoney(r.priceCents) : "On request"}
                    </span>
                  </div>
                ))}
              {total > 0 && (
                <div className="flex items-center justify-between gap-4 bg-canvas px-5 py-4">
                  <span className="text-[15px] font-bold text-ink">Everything together</span>
                  <span className="text-[16px] font-extrabold text-ink">{formatMoney(total)}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {kit.brands.length > 0 && (
          <section className="mt-6">
            <h2 className="text-[13px] font-bold tracking-wider text-ink-muted uppercase">Previously worked with</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {kit.brands.map((b) => (
                <li
                  key={b}
                  className="rounded-full border border-line bg-surface px-4 py-2 text-[14.5px] font-semibold text-ink"
                >
                  {b}
                </li>
              ))}
            </ul>
          </section>
        )}

        {user.socials.length > 0 && (
          <section className="mt-6">
            <h2 className="text-[13px] font-bold tracking-wider text-ink-muted uppercase">Channels</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {user.socials.map((s) => {
                const p = socialPlatform(s.platform);
                if (!p) return null;
                const Icon = p.icon;
                return (
                  <li key={s.id}>
                    <a
                      href={safeUrl(s.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[14.5px] font-semibold text-ink transition hover:border-ink"
                    >
                      <Icon width={16} height={16} style={{ color: p.color }} />
                      {p.name}
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="mt-10 rounded-[24px] bg-ink p-7 text-center">
          <p className="text-[19px] font-bold text-white">Want to work together?</p>
          <p className="mt-2 text-[15px] text-white/60">Send a note and I’ll reply within two business days.</p>
          <a
            href={`mailto:${user.email}`}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-lime px-5 py-3 text-[15px] font-bold text-ink transition hover:brightness-95"
          >
            <Mail className="size-4" aria-hidden />
            Get in touch
          </a>
        </section>

        <p className="mt-10 text-center text-[13px] text-ink-muted">
          Built with{" "}
          <Link href="/" className="font-semibold text-ink underline underline-offset-4">
            Plink
          </Link>
        </p>
      </div>
    </div>
  );
}
