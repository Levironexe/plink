import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/marketing/hero";
import { StatStrip } from "@/components/marketing/stat-strip";
import { FeatureBento } from "@/components/marketing/feature-bento";
import { Showcase } from "@/components/marketing/showcase";
import { TemplateMarquee } from "@/components/marketing/template-marquee";
import { Testimonials } from "@/components/marketing/testimonials";
import { PricingTable } from "@/components/marketing/pricing-table";
import { Faq } from "@/components/marketing/faq";
import { BigCta } from "@/components/marketing/cta";
import { SectionHeading } from "@/components/marketing/section";
import { Reveal } from "@/components/marketing/reveal";

export default function HomePage() {
  return (
    <>
      <Hero />

      <section className="mx-auto max-w-6xl px-5">
        <Reveal>
          <StatStrip />
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-28 sm:pt-36">
        <Reveal>
          <SectionHeading
            eyebrow="One page, six jobs"
            title="Not a list of links. A business in a bio."
            body="Most link tools stop at a stack of buttons. Plink gives you the store, the mailing list, the media kit and the numbers behind them."
          />
        </Reveal>
        <div className="mt-14">
          <FeatureBento />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-28 sm:pt-36">
        <Showcase />
      </section>

      <section className="pt-28 sm:pt-36">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <SectionHeading
              eyebrow="Templates"
              title="Start from something beautiful"
              body="Every template is a real, working page. Pick one, make it yours, publish."
            />
          </Reveal>
        </div>
        <div className="mt-14">
          <TemplateMarquee />
        </div>
        <div className="mt-10 flex justify-center">
          <Link
            href="/templates"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-3 text-[15px] font-semibold text-ink shadow-soft transition hover:border-ink"
          >
            See all templates
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-28 sm:pt-36">
        <Reveal>
          <SectionHeading
            eyebrow="Creators"
            title="They stopped juggling five tools"
            align="center"
          />
        </Reveal>
        <div className="mt-14">
          <Testimonials />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-28 sm:pt-36">
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

      <section className="mx-auto max-w-6xl px-5 pt-28 sm:pt-36" id="faq">
        <Reveal>
          <SectionHeading eyebrow="Questions" title="Everything else" />
        </Reveal>
        <div className="mt-12">
          <Faq />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-28 sm:py-36">
        <BigCta />
      </section>
    </>
  );
}
