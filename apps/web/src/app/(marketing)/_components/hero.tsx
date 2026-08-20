import { ClaimUsername } from "./claim-username";
import { PhoneFrame } from "@/components/profile/phone-frame";
import { ProfileView } from "@/components/profile/profile-view";
import { DEMO_PROFILES } from "@plink/core/demo-profiles";
import { generatedAvatar } from "@plink/core/avatar";
import { Eyebrow } from "./section";

const FACES = ["mayabuilds", "noahcooks", "atlas.sound", "kiralifts", "omatravels"];

export function Hero() {
  const [primary, secondary, tertiary] = DEMO_PROFILES;

  return (
    <section className="relative overflow-hidden pt-16 pb-24 lg:pt-24 lg:pb-32">
      {/* The mesh is the entire decorative system — hero scale only, never miniaturised. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-64 -z-10 h-[720px]">
        <div className="mesh-gradient absolute inset-0 opacity-[0.16] blur-[120px]" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-canvas" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-16 px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
        <div className="flex flex-col items-start">
          <Eyebrow className="animate-rise">One link for everything you make</Eyebrow>

          <h1 className="mt-6 max-w-[14ch] text-[clamp(2.5rem,5.5vw,3.75rem)] leading-[1.02] font-semibold tracking-[-0.05em] text-ink">
            Your whole world, one link.
          </h1>

          <p className="mt-6 max-w-lg text-[18px] leading-7 text-ink-soft">
            A link in bio, a storefront, an email list, a booking calendar and a media kit — on one
            page you can ship in about two minutes.
          </p>

          <div className="mt-8 w-full max-w-lg">
            <ClaimUsername />
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <div className="flex -space-x-2">
              {FACES.map((seed) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={seed}
                  src={generatedAvatar(seed)}
                  alt=""
                  className="size-8 rounded-full ring-2 ring-canvas"
                />
              ))}
            </div>
            <p className="font-mono text-[12px] leading-4 text-ink-muted">
              Trusted by creators in 40+ countries
            </p>
          </div>
        </div>

        {/* Phones */}
        <div className="relative mx-auto hidden h-[600px] w-full max-w-[560px] lg:block">
          <div className="absolute top-20 -left-6 w-[206px] rotate-[-8deg] animate-float [--tilt:-8deg] [animation-delay:-1.5s]">
            <PhoneFrame className="max-w-none" chrome={false}>
              <ProfileView profile={secondary} preview />
            </PhoneFrame>
          </div>
          <div className="absolute top-2 left-1/2 z-20 w-[276px] -translate-x-1/2 animate-float">
            <PhoneFrame className="max-w-none">
              <ProfileView profile={primary} preview />
            </PhoneFrame>
          </div>
          <div className="absolute top-24 -right-6 w-[206px] rotate-[8deg] animate-float [--tilt:8deg] [animation-delay:-3s]">
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
