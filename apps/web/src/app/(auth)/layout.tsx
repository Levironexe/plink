import Link from "next/link";
import { Logo } from "@/components/logo";
import { ProfileView } from "@/components/profile/profile-view";
import { PhoneFrame } from "@/components/profile/phone-frame";
import { DEMO_PROFILES } from "@plink/core/demo-profiles";
import { ToastProvider } from "@plink/ui/toast";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="grid min-h-dvh lg:grid-cols-2">
        <div className="flex flex-col px-5 py-6 sm:px-10">
          <div className="flex items-center justify-between">
            <Logo />
            <Link href="/" className="text-[14px] tracking-[-0.02em] text-ink-soft transition-colors hover:text-ink">
              ← Back to site
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-[400px]">{children}</div>
          </div>
        </div>

        <aside className="relative hidden overflow-hidden bg-ink lg:flex lg:items-center lg:justify-center">
          <div aria-hidden className="mesh-gradient pointer-events-none absolute inset-0 opacity-25 blur-[100px]" />
          <div className="relative flex flex-col items-center gap-10 px-10">
            <div className="max-w-sm text-center">
              <p className="text-[26px] leading-8 font-semibold tracking-[-0.04em] text-white">
                One link for everything you make, sell and share.
              </p>
              <p className="mt-3 text-[15px] leading-6 text-white/60">
                Replace the five tools you&rsquo;re juggling with one page.
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
