import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseMediaKit } from "@/lib/media-kit";
import { MediaKitEditor } from "@/components/dashboard/media-kit-editor";

export const metadata: Metadata = { title: "Media kit" };

export default async function MediaKitPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const row = await prisma.mediaKit.findUnique({ where: { userId: user.id } });

  return (
    <MediaKitEditor
      initial={parseMediaKit(row)}
      username={user.username}
      displayName={user.displayName}
      isPro={user.plan !== "free"}
    />
  );
}
