import { ClaimUsername } from "./claim-username";

export function BigCta() {
  return (
    <section className="relative overflow-hidden rounded-xl bg-ink px-6 py-20 text-center sm:px-12 sm:py-24">
      {/* The mesh, dimmed against the ink band. */}
      <div aria-hidden className="mesh-gradient pointer-events-none absolute inset-0 opacity-25 blur-[90px]" />
      <div className="relative flex flex-col items-center">
        <h2 className="max-w-2xl text-[clamp(1.75rem,4.5vw,2.75rem)] leading-[1.1] font-semibold tracking-[-0.045em] text-white">
          Claim your link today.
        </h2>
        <p className="mt-4 max-w-lg text-[16px] leading-6 text-white/60">
          Free to start, live in two minutes, yours to keep.
        </p>
        <div className="mt-8 flex w-full justify-center">
          <ClaimUsername />
        </div>
      </div>
    </section>
  );
}
