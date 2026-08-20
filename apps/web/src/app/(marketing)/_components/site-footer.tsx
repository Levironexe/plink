import Link from "next/link";
import { Logo } from "@/components/logo";
import { InstagramIcon, TiktokIcon, XIcon, YoutubeIcon } from "@plink/core/brand-icons";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/templates", label: "Templates" },
      { href: "/pricing", label: "Pricing" },
      { href: "/explore", label: "Explore creators" },
      { href: "/signup", label: "Get started" },
    ],
  },
  {
    title: "Built for",
    links: [
      { href: "/templates?for=creators", label: "Creators" },
      { href: "/templates?for=musicians", label: "Musicians" },
      { href: "/templates?for=coaches", label: "Coaches" },
      { href: "/templates?for=studios", label: "Studios" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/pricing#faq", label: "FAQ" },
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "https://github.com/Levironexe/plink", label: "Source" },
    ],
  },
];

const SOCIALS = [
  { icon: InstagramIcon, label: "Instagram", href: "https://instagram.com" },
  { icon: TiktokIcon, label: "TikTok", href: "https://tiktok.com" },
  { icon: XIcon, label: "X", href: "https://x.com" },
  { icon: YoutubeIcon, label: "YouTube", href: "https://youtube.com" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[14px] leading-5 tracking-[-0.02em] text-ink-soft">
            One link for everything you make, sell and share. Free forever, upgrade when you outgrow it.
          </p>
          <div className="mt-5 flex gap-2">
            {SOCIALS.map(({ icon: Icon, label, href }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                target="_blank"
                rel="noopener noreferrer"
                className="grid size-8 place-items-center rounded-full border border-line bg-surface text-ink-soft transition-colors hover:bg-ink hover:text-white"
              >
                <Icon width={17} height={17} />
              </a>
            ))}
          </div>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="font-mono text-[12px] leading-4 text-ink-muted">{col.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-[14px] tracking-[-0.02em] text-ink-soft transition-colors hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 font-mono text-[12px] leading-4 text-ink-muted sm:flex-row">
          <p>© {new Date().getFullYear()} Plink. An independent, open-source study of the link-in-bio category.</p>
          <p>Made for creators everywhere.</p>
        </div>
      </div>
    </footer>
  );
}
