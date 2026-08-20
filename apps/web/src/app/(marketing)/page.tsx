import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero } from "./_components/hero";
import { StatStrip } from "./_components/stat-strip";
import { FeatureBento } from "./_components/feature-bento";
import { Showcase } from "./_components/showcase";
import { TemplateMarquee } from "./_components/template-marquee";
import { Testimonials } from "./_components/testimonials";
import { PricingTable } from "./_components/pricing-table";
import { Faq } from "./_components/faq";
import { BigCta } from "./_components/cta";
import { SectionHeading } from "./_components/section";
import { Reveal } from "./_components/reveal";

export default function HomePage() {
  return (
    <>
      <Hero />

      <section className="mx-auto max-w-6xl px-6">
        <Reveal>
          <StatStrip />
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-6 pt-24 sm:pt-32">
        <Reveal>
          <SectionHeading
            eyebrow="One page, every job"
            title="Not a list of links. A business in a bio."
            body="Most link tools stop at a stack of buttons. Plink gives you the store, the mailing list, the media kit and the numbers behind them."
          />
        </Reveal>
        <div className="mt-12">
          <FeatureBento />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pt-24 sm:pt-32">
        <Showcase />
      </section>

      <section className="pt-24 sm:pt-32">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <SectionHeading
              eyebrow="Templates"
              title="Start from something that already works."
              body="Every template is a real, working page. Pick one, make it yours, publish."
            />
          </Reveal>
        </div>
        <div className="mt-12">
          <TemplateMarquee />
        </div>
        <div className="mt-10 flex justify-center">
          <Link
            href="/templates"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-[14px] font-medium tracking-[-0.02em] text-ink shadow-soft transition-colors hover:border-line-strong/50 hover:bg-canvas-deep"
          >
            See all templates
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pt-24 sm:pt-32">
        <Reveal>
          <SectionHeading
            eyebrow="Creators"
            title="Built by people who ship."
            align="center"
          />
        </Reveal>
        <div className="mt-12">
          <Testimonials />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pt-24 sm:pt-32">
        <Reveal>
          <SectionHeading
            eyebrow="Pricing"
            title="Free to start. Cheap to grow."
            body="No fee to publish. No fee to grow an audience. Pay only when you want the professional extras."
          />
        </Reveal>
        <div className="mt-12">
          <PricingTable />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pt-24 sm:pt-32" id="faq">
        <Reveal>
          <SectionHeading eyebrow="Questions" title="Everything else." />
        </Reveal>
        <div className="mt-12">
          <Faq />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <BigCta />
      </section>
    </>
  );
}
