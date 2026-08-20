import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { getSessionUserId } from "@/lib/auth";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const userId = await getSessionUserId();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteNav signedIn={Boolean(userId)} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
