"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Palette, ChartColumn, Store, Users, Newspaper, Settings,
  CalendarDays, Mails, CreditCard, ExternalLink, LogOut, Menu, X, Check, Copy,
  ArrowUpRight,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@plink/core/utils";
import { useToast } from "@plink/ui/toast";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

type NavGroup = { title: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    title: "Page",
    items: [
      { href: "/dashboard", label: "My page", icon: LayoutDashboard, exact: true },
      { href: "/dashboard/appearance", label: "Appearance", icon: Palette },
      { href: "/dashboard/analytics", label: "Analytics", icon: ChartColumn },
    ],
  },
  {
    title: "Earn",
    items: [
      { href: "/dashboard/store", label: "Store", icon: Store },
      { href: "/dashboard/calendar", label: "Bookings", icon: CalendarDays },
      { href: "/dashboard/media-kit", label: "Media kit", icon: Newspaper },
    ],
  },
  {
    title: "Grow",
    items: [
      { href: "/dashboard/audience", label: "Audience", icon: Users },
      { href: "/dashboard/broadcasts", label: "Broadcasts", icon: Mails },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function DashboardShell({
  username,
  displayName,
  avatarUrl,
  plan,
  children,
}: {
  username: string;
  displayName: string;
  avatarUrl: string;
  plan: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [lastPath, setLastPath] = React.useState(pathname);

  // Navigating always dismisses the mobile menu.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  async function copyLink() {
    const url = `${window.location.origin}/${username}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Link copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Couldn’t copy — select the link manually", "error");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-5" aria-label="Dashboard">
      {NAV.map((group) => (
        <div key={group.title}>
          <p className="px-3 pb-1.5 font-mono text-[12px] leading-4 text-ink-muted">{group.title}</p>
          <div className="flex flex-col gap-px">
            {group.items.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-[14px] tracking-[-0.02em] transition-colors",
                    active
                      ? "bg-canvas-deep font-medium text-ink"
                      : "text-ink-soft hover:bg-canvas-deep hover:text-ink",
                  )}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const account = (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex items-center gap-3 rounded-md border border-line bg-surface p-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium tracking-[-0.02em] text-ink">{displayName}</p>
          <p className="truncate font-mono text-[12px] leading-4 text-ink-muted">@{username}</p>
        </div>
        <button
          onClick={logout}
          aria-label="Log out"
          className="shrink-0 rounded-md p-2 text-ink-muted transition-colors hover:bg-canvas-deep hover:text-ink"
        >
          <LogOut className="size-4" />
        </button>
      </div>
      {plan === "free" && (
        <Link
          href="/dashboard/billing"
          className="group mt-2 flex items-center gap-2.5 rounded-md bg-ink p-3 text-white transition-colors hover:bg-ink/90"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium tracking-[-0.02em]">Upgrade to Pro</span>
            <span className="block font-mono text-[12px] leading-4 text-white/60">
              Custom domain · lower fees
            </span>
          </span>
          <ArrowUpRight
            className="size-4 shrink-0 text-white/60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden
          />
        </Link>
      )}
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-canvas">
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col overflow-y-auto border-r border-line bg-surface px-3 py-5 lg:flex">
        <div className="px-2">
          <Logo />
        </div>

        <div className="mt-6 rounded-md border border-line bg-canvas p-3">
          <p className="font-mono text-[12px] leading-4 text-ink-muted">Your link</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink">
              plink.to/{username}
            </span>
            <button
              onClick={copyLink}
              aria-label="Copy your link"
              className="shrink-0 rounded-md p-1.5 text-ink-muted transition-colors hover:bg-canvas-deep hover:text-ink"
            >
              {copied ? <Check className="size-3.5 text-brand-500" /> : <Copy className="size-3.5" />}
            </button>
            <Link
              href={`/${username}`}
              target="_blank"
              aria-label="Open your page in a new tab"
              className="shrink-0 rounded-md p-1.5 text-ink-muted transition-colors hover:bg-canvas-deep hover:text-ink"
            >
              <ExternalLink className="size-3.5" />
            </Link>
          </div>
        </div>

        <div className="mt-6 flex flex-1 flex-col">{nav}</div>
        {account}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur-xl lg:hidden">
          <Logo />
          <div className="flex items-center gap-1.5">
            <Link
              href={`/${username}`}
              target="_blank"
              className="rounded-md border border-line px-3 py-1.5 text-[14px] font-medium tracking-[-0.02em] text-ink"
            >
              View page
            </Link>
            <button
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className="grid size-10 place-items-center rounded-md text-ink transition-colors hover:bg-canvas-deep"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </header>

        {open && (
          <div className="fixed inset-x-0 top-16 bottom-0 z-40 flex flex-col overflow-y-auto border-t border-line bg-surface px-4 py-4 lg:hidden">
            {nav}
            {account}
          </div>
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
