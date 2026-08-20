import Link from "next/link";
import { ProfileView } from "@/components/profile/profile-view";
import { DEMO_PROFILES } from "@plink/core/demo-profiles";

function Card({ profile }: { profile: (typeof DEMO_PROFILES)[number] }) {
  return (
    <Link
      href={`/${profile.username}`}
      className="group block w-[232px] shrink-0 overflow-hidden rounded-xl border border-line bg-surface shadow-soft transition-shadow duration-200 hover:shadow-lift"
    >
      <div className="relative h-[380px] w-full overflow-hidden">
        <div className="pointer-events-none absolute top-0 left-0 h-[200%] w-[200%] origin-top-left scale-50">
          <ProfileView profile={profile} preview />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium tracking-[-0.02em] text-ink">{profile.displayName}</p>
          <p className="truncate font-mono text-[12px] leading-4 text-ink-muted">@{profile.username}</p>
        </div>
        <span className="shrink-0 rounded-full border border-line bg-surface px-2.5 py-0.5 font-mono text-[12px] leading-4 text-ink-muted transition-colors group-hover:bg-ink group-hover:text-white">
          View
        </span>
      </div>
    </Link>
  );
}

export function TemplateMarquee() {
  const row = [...DEMO_PROFILES, ...DEMO_PROFILES];
  return (
    <div className="relative overflow-hidden py-2">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-canvas to-transparent sm:w-32" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-canvas to-transparent sm:w-32" />
      <div className="flex w-max gap-5 animate-marquee hover:[animation-play-state:paused]">
        {row.map((p, i) => (
          <Card key={`${p.id}-${i}`} profile={p} />
        ))}
      </div>
    </div>
  );
}
