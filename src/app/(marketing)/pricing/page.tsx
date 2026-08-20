import * as React from "react";
import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { PricingTable } from "@/components/marketing/pricing-table";
import { Faq } from "@/components/marketing/faq";
import { BigCta } from "@/components/marketing/cta";
import { SectionHeading } from "@/components/marketing/section";
import { Reveal } from "@/components/marketing/reveal";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Plink is free forever. Upgrade to Pro for 0% fees, a custom domain and a media kit.",
};

const COMPARE: { group: string; rows: [string, boolean | string, boolean | string, boolean | string][] }[] = [
  {
    group: "Your page",
    rows: [
      ["Unlimited links & blocks", true, true, true],
      ["All 12 themes", true, true, true],
      ["Custom colours & fonts", true, true, true],
      ["Remove Plink badge", false, true, true],
      ["Custom domain", false, true, true],
      ["Multiple pages", false, false, "5 pages"],
    ],
  },
  {
    group: "Selling",
    rows: [
      ["Products", "3", "Unlimited", "Unlimited"],
      ["Platform fee", "5%", "0%", "0%"],
      ["Tip jar", true, true, true],
      ["Bookings", false, true, true],
    ],
  },
  {
    group: "Audience",
    rows: [
      ["Email subscribers", "500", "Unlimited", "Unlimited"],
      ["CSV export", true, true, true],
      ["Segments", false, false, true],
      ["Media kit", false, true, true],
    ],
  },
  {
    group: "Data",
    rows: [
      ["Analytics history", "7 days", "Unlimited", "Unlimited"],
      ["Referrer & device data", false, true, true],
      ["Export API", false, false, true],
    ],
  },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="mx-auto size-[18px] text-brand-600" aria-label="Included" />;
  if (value === false) return <Minus className="mx-auto size-[18px] text-line-strong" aria-label="Not included" />;
  return <span className="text-[14px] font-semibold text-ink">{value}</span>;
}

export default function PricingPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pt-16 sm:pt-24">
        <SectionHeading
          eyebrow="Pricing"
          title="Start free. Upgrade when it pays for itself."
          body="Every plan includes an unlimited page. You only pay when you want zero fees, your own domain and the professional extras."
        />
        <div className="mt-14">
          <PricingTable />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pt-28">
        <Reveal>
          <h2 className="text-center text-[clamp(1.7rem,3.4vw,2.4rem)] font-extrabold text-ink">
            Compare every feature
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="w-2/5 pb-4 text-left text-[13px] font-bold tracking-wider text-ink-muted uppercase">
                    Feature
                  </th>
                  {["Free", "Pro", "Studio"].map((p) => (
                    <th key={p} className="pb-4 text-center text-[15px] font-extrabold text-ink">
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((section) => (
                  <React.Fragment key={section.group}>
                    <tr>
                      <td colSpan={4} className="pt-6 pb-2 text-[13px] font-bold tracking-wider text-brand-600 uppercase">
                        {section.group}
                      </td>
                    </tr>
                    {section.rows.map(([label, free, pro, vip]) => (
                      <tr key={label} className="group">
                        <td className="border-t border-line py-3.5 text-[15px] text-ink-soft">{label}</td>
                        <td className="border-t border-line py-3.5 text-center"><Cell value={free} /></td>
                        <td className="border-t border-line bg-brand-50/40 py-3.5 text-center"><Cell value={pro} /></td>
                        <td className="border-t border-line py-3.5 text-center"><Cell value={vip} /></td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-28" id="faq">
        <SectionHeading eyebrow="Questions" title="Before you commit" />
        <div className="mt-12">
          <Faq />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-28">
        <BigCta />
      </section>
    </>
  );
}
