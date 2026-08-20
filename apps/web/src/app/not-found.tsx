import Link from "next/link";
import { ButtonLink } from "@plink/ui/button";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <Logo />
      <p className="mt-10 font-display text-[80px] leading-none font-semibold text-brand-200">404</p>
      <h1 className="mt-2 text-[28px] font-semibold text-ink">We couldn’t find that page</h1>
      <p className="mt-3 max-w-sm text-[16px] leading-relaxed text-ink-muted">
        The link may be out of date, or the page may have moved.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/" variant="ink" size="lg">Back to home</ButtonLink>
        <ButtonLink href="/explore" variant="outline" size="lg">Explore creators</ButtonLink>
      </div>
      <Link href="/signup" className="mt-8 text-[14px] font-semibold text-ink-muted underline underline-offset-4">
        Create your own Plink
      </Link>
    </div>
  );
}
