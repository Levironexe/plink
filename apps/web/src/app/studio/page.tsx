import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { FolderKanban, Globe } from "lucide-react";
import { prisma } from "@plink/db";
import { getSessionUserId } from "@/lib/auth";
import { PageHeader, EmptyState } from "./_components/primitives";
import { CreateWorkspaceForm } from "./_components/create-workspace-form";
import { NewSiteButton } from "./_components/new-site-form";
import { SiteCard } from "./_components/site-card";

export const metadata: Metadata = {
  title: "Studio · Plink",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const workspaces = await prisma.workspace.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" },
    include: {
      sites: {
        orderBy: { createdAt: "asc" },
        include: { brief: { select: { status: true } } },
      },
    },
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-4">
        <Link
          href="/dashboard"
          className="text-[13px] tracking-[-0.01em] text-ink-muted transition-colors hover:text-ink"
        >
          ← Back to dashboard
        </Link>
      </div>

      <PageHeader
        title="Studio"
        description="Client workspaces — every site starts as a brief and grows into a published website."
      />

      {workspaces.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={FolderKanban}
            title="Create your first workspace"
            body="A workspace groups the sites you run for one client roster. Name it after your studio or agency."
            action={<CreateWorkspaceForm autoFocus />}
          />
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {workspaces.map((workspace) => (
            <section key={workspace.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="eyebrow uppercase">workspace</p>
                  <h2 className="mt-0.5 text-[18px] font-semibold tracking-[-0.03em] text-ink">{workspace.name}</h2>
                </div>
                <NewSiteButton workspaceId={workspace.id} workspaceName={workspace.name} />
              </div>

              {workspace.sites.length === 0 ? (
                <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-line bg-canvas px-6 py-10 text-center">
                  <Globe className="size-5 text-ink-muted" aria-hidden />
                  <p className="mt-3 text-[14px] leading-5 tracking-[-0.02em] text-ink-soft">
                    No sites yet — create the first one and fill in its brief.
                  </p>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {workspace.sites.map((site) => (
                    <SiteCard
                      key={site.id}
                      site={{
                        id: site.id,
                        name: site.name,
                        slug: site.slug,
                        template: site.template,
                        status: site.status,
                        clientName: site.clientName,
                        briefStatus: site.brief?.status ?? null,
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}

          <section className="border-t border-line pt-8">
            <p className="eyebrow mb-3 uppercase">new workspace</p>
            <CreateWorkspaceForm />
          </section>
        </div>
      )}
    </main>
  );
}
