"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "./logo";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
        scrolled ? "border-b border-line bg-canvas/85 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:h-[72px]" aria-label="Main">
        <Logo />

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-xl px-3.5 py-2 text-[15px] font-medium text-ink-soft transition hover:bg-black/5 hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <ButtonLink href="/dashboard" variant="ink" size="sm">
              Dashboard
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm">
                Log in
              </ButtonLink>
              <ButtonLink href="/signup" variant="ink" size="sm">
                Sign up free
              </ButtonLink>
            </>
          )}
        </div>

        <button
          className="grid size-10 place-items-center rounded-xl text-ink transition hover:bg-black/5 md:hidden"
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
              className="rounded-2xl px-4 py-3.5 text-lg font-semibold text-ink transition hover:bg-black/5"
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-4 flex flex-col gap-2.5">
            {signedIn ? (
              <ButtonLink href="/dashboard" variant="ink" size="lg" fullWidth>
                Go to dashboard
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/signup" variant="ink" size="lg" fullWidth>
                  Sign up free
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
