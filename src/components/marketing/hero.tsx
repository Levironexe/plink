import { ClaimUsername } from "./claim-username";
import { PhoneFrame } from "@/components/profile/phone-frame";
import { ProfileView } from "@/components/profile/profile-view";
import { DEMO_PROFILES } from "@/lib/demo-profiles";
import { generatedAvatar } from "@/lib/avatar";
import { Eyebrow } from "./section";
import { Sparkles } from "lucide-react";

const FACES = ["mayabuilds", "noahcooks", "atlas.sound", "kiralifts", "omatravels"];

export function Hero() {
  const [primary, secondary, tertiary] = DEMO_PROFILES;

  return (
    <section className="relative overflow-hidden pt-12 pb-24 sm:pt-16 lg:pb-32">
      {/* ambient colour */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 size-[720px] -translate-x-1/2 rounded-full bg-brand-200/45 blur-[130px]" />
        <div className="absolute top-40 -right-32 size-[460px] rounded-full bg-butter/40 blur-[120px]" />
        <div className="absolute top-72 -left-40 size-[420px] rounded-full bg-sky/25 blur-[120px]" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-16 px-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
        <div className="flex flex-col items-start">
          <Eyebrow className="animate-rise">
            <Sparkles className="size-3.5 text-brand-500" aria-hidden />
            The creator platform, not just a link list
          </Eyebrow>

          <h1 className="mt-6 max-w-[15ch] text-[clamp(2.3rem,5vw,3.5rem)] leading-[1.02] font-extrabold text-ink">
            Everything you are.
            <br />
            <span className="relative inline-block">
              <span className="relative z-10">One link.</span>
              <svg
                className="absolute -bottom-2 left-0 z-0 h-4 w-full text-lime"
                viewBox="0 0 200 16"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path d="M2 11c40-7 92-9 196-6" stroke="currentColor" strokeWidth="7" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </h1>

          <p className="mt-6 max-w-lg text-[18px] leading-relaxed text-ink-soft">
            Build a link in bio, sell your products, grow an email list and pitch brands with a real
            media kit — all from one page that takes two minutes to set up.
          </p>

          <div className="mt-8 w-full">
            <ClaimUsername />
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <div className="flex -space-x-2.5">
              {FACES.map((seed) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={seed}
                  src={generatedAvatar(seed)}
                  alt=""
                  className="size-9 rounded-full ring-[3px] ring-canvas"
                />
              ))}
            </div>
            <p className="text-[14.5px] leading-snug text-ink-muted">
              <strong className="font-bold text-ink">4.2 million creators</strong>
              <br className="sm:hidden" /> already share one link.
            </p>
          </div>
        </div>

        {/* Phones */}
        <div className="relative mx-auto hidden h-[600px] w-full max-w-[560px] lg:block">
          <div className="absolute top-20 -left-6 w-[206px] rotate-[-10deg] animate-float [--tilt:-10deg] [animation-delay:-1.5s]">
            <PhoneFrame className="max-w-none" chrome={false}>
              <ProfileView profile={secondary} preview />
            </PhoneFrame>
          </div>
          <div className="absolute top-2 left-1/2 z-20 w-[276px] -translate-x-1/2 animate-float">
            <PhoneFrame className="max-w-none">
              <ProfileView profile={primary} preview />
            </PhoneFrame>
          </div>
          <div className="absolute top-24 -right-6 w-[206px] rotate-[10deg] animate-float [--tilt:10deg] [animation-delay:-3s]">
            <PhoneFrame className="max-w-none" chrome={false}>
              <ProfileView profile={tertiary} preview />
            </PhoneFrame>
          </div>
        </div>

        {/* Mobile: single phone */}
        <div className="mx-auto flex w-full justify-center lg:hidden">
          <PhoneFrame>
            <ProfileView profile={primary} preview />
          </PhoneFrame>
        </div>
      </div>
    </section>
  );
}
