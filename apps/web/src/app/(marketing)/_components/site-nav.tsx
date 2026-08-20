"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@plink/ui/button";
import { cn } from "@plink/core/utils";

const LINKS = [
  { href: "/templates", label: "Templates" },
  { href: "/explore", label: "Explore" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled ? "border-b border-line bg-canvas/80 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6" aria-label="Main">
        <Logo />

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-3 py-1.5 text-[14px] tracking-[-0.02em] text-ink-soft transition-colors hover:bg-canvas-deep hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <ButtonLink href="/dashboard" variant="primary" size="sm">
              Dashboard
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm">
                Log in
              </ButtonLink>
              <ButtonLink href="/signup" variant="primary" size="sm">
                Sign up
              </ButtonLink>
            </>
          )}
        </div>

        <button
          className="grid size-10 place-items-center rounded-md text-ink transition-colors hover:bg-canvas-deep md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {open && (
        <div className="fixed inset-x-0 top-16 bottom-0 z-40 flex flex-col gap-1 border-t border-line bg-canvas px-5 pt-4 md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-4 py-3 text-[16px] font-medium tracking-[-0.02em] text-ink transition-colors hover:bg-canvas-deep"
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-4 flex flex-col gap-2.5">
            {signedIn ? (
              <ButtonLink href="/dashboard" variant="primary" size="lg" fullWidth>
                Go to dashboard
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/signup" variant="primary" size="lg" fullWidth>
                  Sign up
                </ButtonLink>
                <ButtonLink href="/login" variant="outline" size="lg" fullWidth>
                  Log in
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
