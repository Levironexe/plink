import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { loadPublicProfile } from "@/lib/profile";
import { ProfileView } from "@/components/profile/profile-view";
import { PageViewTracker } from "./_components/page-view-tracker";
import { ProfileActions } from "./_components/profile-actions";
import { isReservedUsername } from "@plink/core/utils";

type Params = { params: Promise<{ username: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  const profile = await loadPublicProfile(username);
  if (!profile) return { title: "Page not found" };

  const title = `${profile.displayName} (@${profile.username})`;
  const description = profile.bio || `Everything from ${profile.displayName}, in one link.`;

  return {
    title,
    description,
    alternates: { canonical: `/${profile.username}` },
    openGraph: {
      title,
      description,
      url: `/${profile.username}`,
      type: "profile",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ProfilePage({ params }: Params) {
  const { username } = await params;
  if (isReservedUsername(username)) notFound();

  const profile = await loadPublicProfile(username);
  if (!profile) notFound();

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "plink.to";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const shareUrl = `${proto}://${host}/${profile.username}`;

  return (
    <div className="relative min-h-dvh">
      <PageViewTracker userId={profile.id} />
      <ProfileActions username={profile.username} theme={profile.theme} url={shareUrl} />
      <ProfileView profile={profile} className="min-h-dvh" />
    </div>
  );
}
