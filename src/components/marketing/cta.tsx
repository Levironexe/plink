import { ClaimUsername } from "./claim-username";

export function BigCta() {
  return (
    <section className="relative overflow-hidden rounded-[36px] bg-ink px-6 py-20 text-center sm:px-12 sm:py-24">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/4 size-[420px] rounded-full bg-brand-600/50 blur-[110px]" />
        <div className="absolute -bottom-32 right-1/4 size-[380px] rounded-full bg-[#ff6b5a]/30 blur-[110px]" />
      </div>
      <div className="relative flex flex-col items-center">
        <h2 className="max-w-2xl text-[clamp(2rem,5vw,3.4rem)] leading-[1.03] font-extrabold text-white">
          Your whole world,{" "}
          <span className="bg-gradient-to-r from-lime via-butter to-coral bg-clip-text text-transparent">
            one link away
          </span>
        </h2>
        <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-white/65">
          Claim your name before someone else does. Free forever, live in two minutes.
        </p>
        <div className="mt-9 flex w-full justify-center">
          <ClaimUsername />
        </div>
      </div>
    </section>
  );
}
