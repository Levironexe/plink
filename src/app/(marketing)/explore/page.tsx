import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CircleCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { DEMO_PROFILES } from "@/lib/demo-profiles";
import { generatedAvatar } from "@/lib/avatar";
import { SectionHeading } from "@/components/marketing/section";
import { Reveal } from "@/components/marketing/reveal";
import { BigCta } from "@/components/marketing/cta";
import { initialsOf } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Explore creators",
  description: "Browse Plink pages from creators, musicians, coaches and studios.",
};

export const revalidate = 60;

type Card = {
  username: string;
  displayName: string;
  bio: string;
  category: string | null;
  avatarUrl: string | null;
  verified: boolean;
  demo: boolean;
};

async function loadCreators(): Promise<Card[]> {
  const real = await prisma.user.findMany({
    where: { onboarded: true },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: {
      username: true, displayName: true, bio: true, category: true,
      avatarUrl: true, verified: true,
    },
  });

  // A real account always supersedes the static demo that shares its handle.
  const claimed = new Set(real.map((r) => r.username));
  const demos: Card[] = DEMO_PROFILES.filter((p) => !claimed.has(p.username)).map((p) => ({
    username: p.username,
    displayName: p.displayName,
    bio: p.bio,
    category: p.category,
    avatarUrl: p.avatarUrl,
    verified: p.verified,
    demo: true,
  }));

  return [...real.map((r) => ({ ...r, demo: false })), ...demos];
}

export default async function ExplorePage() {
  const creators = await loadCreators();

  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pt-16 sm:pt-24">
        <SectionHeading
          eyebrow="Explore"
          title="See what people are building"
          body="Pages made with Plink — from producers and coaches to studios and food creators."
        />
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-16 pb-28">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {creators.map((c, i) => (
            <Reveal key={c.username} delay={Math.min(i, 8) * 50}>
              <Link
                href={`/${c.username}`}
                className="group flex h-full flex-col rounded-[24px] border border-line bg-surface p-5 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
              >
                <div className="flex items-center gap-3.5">
                  {c.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.avatarUrl} alt="" className="size-14 rounded-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={generatedAvatar(c.username, initialsOf(c.displayName))}
                      alt=""
                      className="size-14 rounded-full object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-[16px] font-bold text-ink">
                      {c.displayName}
                      {c.verified && <CircleCheck className="size-4 shrink-0 text-brand-500" aria-label="Verified" />}
                    </p>
                    <p className="truncate text-[13.5px] text-ink-muted">@{c.username}</p>
                  </div>
                </div>
                {c.bio && <p className="mt-4 line-clamp-3 flex-1 text-[14.5px] leading-relaxed text-ink-soft">{c.bio}</p>}
                <div className="mt-5 flex items-center justify-between">
                  <span className="rounded-full bg-canvas px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted">
                    {c.category ?? "Creator"}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[13.5px] font-bold text-ink transition group-hover:text-brand-600">
                    Visit
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-28">
        <BigCta />
      </section>
    </>
  );
}
