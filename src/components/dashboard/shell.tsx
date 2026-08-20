"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Palette, ChartColumn, Store, Users, Newspaper, Settings,
  ExternalLink, LogOut, Menu, X, Check, Copy, Crown,
} from "lucide-react";
import { Logo } from "@/components/marketing/logo";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "My page", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/appearance", label: "Appearance", icon: Palette },
  { href: "/dashboard/analytics", label: "Analytics", icon: ChartColumn },
  { href: "/dashboard/store", label: "Store", icon: Store },
  { href: "/dashboard/audience", label: "Audience", icon: Users },
  { href: "/dashboard/media-kit", label: "Media kit", icon: Newspaper },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
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
    <nav className="flex flex-1 flex-col gap-0.5" aria-label="Dashboard">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-semibold transition",
              active ? "bg-ink text-white" : "text-ink-soft hover:bg-black/5 hover:text-ink",
            )}
          >
            <item.icon className="size-[18px] shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const account = (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex items-center gap-3 rounded-2xl bg-canvas p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-ink">{displayName}</p>
          <p className="truncate text-[12.5px] text-ink-muted">@{username}</p>
        </div>
        <button
          onClick={logout}
          aria-label="Log out"
          className="shrink-0 rounded-lg p-2 text-ink-muted transition hover:bg-black/5 hover:text-ink"
        >
          <LogOut className="size-4" />
        </button>
      </div>
      {plan === "free" && (
        <Link
          href="/dashboard/settings"
          className="mt-3 flex items-center gap-2.5 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-3.5 text-white transition hover:brightness-110"
        >
          <Crown className="size-4 shrink-0 text-lime" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-bold">Upgrade to Pro</span>
            <span className="block text-[12px] text-white/70">0% fees · custom domain</span>
          </span>
        </Link>
      )}
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-canvas">
      <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col border-r border-line bg-surface px-4 py-5 lg:flex">
        <div className="px-2">
          <Logo />
        </div>

        <div className="mt-6 rounded-2xl border border-line bg-canvas p-3">
          <p className="text-[11.5px] font-bold tracking-wider text-ink-muted uppercase">Your link</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">
              plink.to/{username}
            </span>
            <button
              onClick={copyLink}
              aria-label="Copy your link"
              className="shrink-0 rounded-lg p-1.5 text-ink-muted transition hover:bg-black/5 hover:text-ink"
            >
              {copied ? <Check className="size-4 text-[#16a34a]" /> : <Copy className="size-4" />}
            </button>
            <Link
              href={`/${username}`}
              target="_blank"
              aria-label="Open your page in a new tab"
              className="shrink-0 rounded-lg p-1.5 text-ink-muted transition hover:bg-black/5 hover:text-ink"
            >
              <ExternalLink className="size-4" />
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
              className="rounded-xl border border-line px-3 py-2 text-[13.5px] font-semibold text-ink"
            >
              View page
            </Link>
            <button
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className="grid size-10 place-items-center rounded-xl text-ink transition hover:bg-black/5"
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
