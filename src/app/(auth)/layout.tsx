import Link from "next/link";
import { Logo } from "@/components/marketing/logo";
import { ProfileView } from "@/components/profile/profile-view";
import { PhoneFrame } from "@/components/profile/phone-frame";
import { DEMO_PROFILES } from "@/lib/demo-profiles";
import { ToastProvider } from "@/components/ui/toast";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="grid min-h-dvh lg:grid-cols-2">
        <div className="flex flex-col px-5 py-6 sm:px-10">
          <div className="flex items-center justify-between">
            <Logo />
            <Link href="/" className="text-[14px] font-semibold text-ink-muted transition hover:text-ink">
              ← Back to site
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-[400px]">{children}</div>
          </div>
        </div>

        <aside className="relative hidden overflow-hidden bg-ink lg:flex lg:items-center lg:justify-center">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-32 -left-20 size-[460px] rounded-full bg-brand-600/45 blur-[120px]" />
            <div className="absolute -right-24 bottom-0 size-[420px] rounded-full bg-coral/25 blur-[120px]" />
          </div>
          <div className="relative flex flex-col items-center gap-10 px-10">
            <div className="max-w-sm text-center">
              <p className="font-display text-[28px] leading-tight font-extrabold text-white">
                One link for everything you make, sell and share.
              </p>
              <p className="mt-3 text-[15px] text-white/60">
                Join 4.2 million creators who stopped juggling five tools.
              </p>
            </div>
            <div className="flex items-end gap-5">
              <div className="w-[190px] rotate-[-6deg]">
                <PhoneFrame className="max-w-none" chrome={false}>
                  <ProfileView profile={DEMO_PROFILES[1]} preview />
                </PhoneFrame>
              </div>
              <div className="w-[220px]">
                <PhoneFrame className="max-w-none" chrome={false}>
                  <ProfileView profile={DEMO_PROFILES[0]} preview />
                </PhoneFrame>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </ToastProvider>
  );
}
