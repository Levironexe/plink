"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Link2, Plus } from "lucide-react";
import { Button } from "@plink/ui/button";
import { useToast } from "@plink/ui/toast";
import { PageHeader, EmptyState } from "./page-header";
import { AddBlockModal } from "./add-block-modal";
import { AiBuilder, type GeneratedPage } from "./ai-builder";
import { BlockCard } from "./block-card";
import { ProfileEditor } from "./profile-editor";
import { LivePreview, MobilePreviewSheet } from "./live-preview";
import type { EditorBlock, EditorData, EditorProfile } from "@plink/core/editor-types";
import type { PublicProfile, PublicSocial } from "@plink/core/profile-types";
import { useDebouncedSave } from "@/lib/hooks";
import {
  addSocial, applyGeneratedPage, createBlock, deleteBlock, deleteSocial,
  duplicateBlock, reorderBlocks, updateBlock, updateProfile,
} from "@/app/dashboard/actions";
import type { BlockDefinition } from "@plink/core/blocks";

export function PageEditor({
  initial,
  aiEnabled = false,
}: {
  initial: EditorData;
  aiEnabled?: boolean;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [profile, setProfile] = React.useState<EditorProfile>(initial.profile);
  const [blocks, setBlocks] = React.useState<EditorBlock[]>(initial.blocks);
  const [socials, setSocials] = React.useState<PublicSocial[]>(initial.socials);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /* ---------------------------------------------------------------- saving */

  const saveProfile = useDebouncedSave<EditorProfile>(async (value) => {
    const res = await updateProfile({
      displayName: value.displayName || value.username,
      bio: value.bio,
      avatarUrl: value.avatarUrl || null,
      bannerUrl: value.bannerUrl || null,
      category: value.category || null,
      location: value.location || null,
    });
    if (!res.ok) toast(res.error, "error");
  });

  const saveBlock = useDebouncedSave<EditorBlock>(async (value) => {
    const res = await updateBlock(value.id, {
      title: value.title,
      subtitle: value.subtitle,
      url: value.url,
      imageUrl: value.imageUrl,
      config: value.config,
      visible: value.visible,
      highlight: value.highlight,
      startsAt: value.startsAt,
      endsAt: value.endsAt,
    });
    if (!res.ok) toast(res.error, "error");
  });

  function patchProfile(patch: Partial<EditorProfile>) {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      saveProfile.schedule(next);
      return next;
    });
  }

  function patchBlock(id: string, patch: Partial<EditorBlock>) {
    setBlocks((prev) => {
      const next = prev.map((b) => (b.id === id ? { ...b, ...patch } : b));
      const changed = next.find((b) => b.id === id);
      if (changed) saveBlock.schedule(changed);
      return next;
    });
  }

  /* --------------------------------------------------------------- actions */

  function handleAdd(def: BlockDefinition) {
    startTransition(async () => {
      const res = await createBlock(def.type);
      if (!res.ok || !res.data) {
        toast(res.ok ? "Could not add block" : res.error, "error");
        return;
      }
      const block: EditorBlock = {
        id: res.data.id,
        type: def.type,
        title: def.defaults.title ?? "",
        subtitle: def.defaults.subtitle ?? "",
        url: def.defaults.url ?? "",
        imageUrl: null,
        config: JSON.stringify(def.defaults.config ?? {}),
        visible: true,
        highlight: false,
        clicks: 0,
        startsAt: null,
        endsAt: null,
      };
      setBlocks((prev) => [...prev, block]);
      setExpanded(block.id);
      toast(`${def.label} added`);
    });
  }

  function handleDelete(id: string) {
    const snapshot = blocks;
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    startTransition(async () => {
      const res = await deleteBlock(id);
      if (!res.ok) {
        setBlocks(snapshot);
        toast(res.error, "error");
      } else {
        toast("Block deleted");
      }
    });
  }

  function handleDuplicate(id: string) {
    startTransition(async () => {
      const res = await duplicateBlock(id);
      if (!res.ok || !res.data) {
        toast(res.ok ? "Could not duplicate" : res.error, "error");
        return;
      }
      setBlocks((prev) => {
        const index = prev.findIndex((b) => b.id === id);
        if (index === -1) return prev;
        const copy: EditorBlock = { ...prev[index], id: res.data!.id, clicks: 0 };
        const next = [...prev];
        next.splice(index + 1, 0, copy);
        return next;
      });
      toast("Block duplicated");
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = blocks.findIndex((b) => b.id === active.id);
    const to = blocks.findIndex((b) => b.id === over.id);
    if (from === -1 || to === -1) return;

    const next = arrayMove(blocks, from, to);
    setBlocks(next);
    startTransition(async () => {
      const res = await reorderBlocks(next.map((b) => b.id));
      if (!res.ok) toast(res.error, "error");
    });
  }

  function handleAddSocial(platform: string, url: string) {
    startTransition(async () => {
      const res = await addSocial({ platform, url });
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      // Re-read from the server so the stored, normalised URL is what we show.
      const fresh = await fetch("/api/socials").then((r) => (r.ok ? r.json() : null));
      if (fresh?.socials) setSocials(fresh.socials as PublicSocial[]);
      toast("Social link saved");
    });
  }

  function handleRemoveSocial(id: string) {
    const snapshot = socials;
    setSocials((prev) => prev.filter((s) => s.id !== id));
    startTransition(async () => {
      const res = await deleteSocial(id);
      if (!res.ok) {
        setSocials(snapshot);
        toast(res.error, "error");
      }
    });
  }

  /* --------------------------------------------------------------- preview */

  const previewProfile: PublicProfile = React.useMemo(
    () => ({
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      bannerUrl: profile.bannerUrl,
      verified: profile.verified,
      category: profile.category,
      location: profile.location,
      theme: initial.theme,
      blocks,
      socials,
      products: initial.products,
    }),
    [profile, blocks, socials, initial.theme, initial.products],
  );

  async function handleApplyGenerated(page: GeneratedPage) {
    const res = await applyGeneratedPage(page);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    toast("Your page has been rebuilt");
    // The action replaced every block, so pull the canonical state back.
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-10">
      <PageHeader
        title="My page"
        description="Add blocks, drag to reorder, and watch the preview update as you type."
        actions={
          <>
            <span
              className={`text-[13px] font-semibold transition-opacity ${pending ? "text-ink-muted opacity-100" : "opacity-0"}`}
              aria-live="polite"
            >
              Saving…
            </span>
            <Button onClick={() => setAdding(true)} size="md">
              <Plus className="size-4" /> Add block
            </Button>
          </>
        }
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <AiBuilder enabled={aiEnabled} socials={socials} onApply={handleApplyGenerated} />

          <ProfileEditor
            profile={profile}
            socials={socials}
            onProfileChange={patchProfile}
            onAddSocial={handleAddSocial}
            onRemoveSocial={handleRemoveSocial}
          />

          {blocks.length === 0 ? (
            <EmptyState
              icon={Link2}
              title="Your page is empty"
              body="Add your first link, then keep going — socials, a newsletter sign-up, a product."
              action={
                <Button onClick={() => setAdding(true)}>
                  <Plus className="size-4" /> Add your first block
                </Button>
              }
            />
          ) : (
            <DndContext
              // A stable id keeps dnd-kit's aria ids identical across SSR and hydration.
              id="plink-block-list"
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-3">
                  {blocks.map((block) => (
                    <BlockCard
                      key={block.id}
                      block={block}
                      expanded={expanded === block.id}
                      onToggleExpand={() => setExpanded(expanded === block.id ? null : block.id)}
                      onChange={(patch) => patchBlock(block.id, patch)}
                      onDelete={() => handleDelete(block.id)}
                      onDuplicate={() => handleDuplicate(block.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <button
            onClick={() => setAdding(true)}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong py-5 text-[15px] font-semibold text-ink-muted transition hover:border-ink hover:text-ink"
          >
            <Plus className="size-4.5" /> Add block
          </button>
        </div>

        <div className="hidden lg:block">
          <LivePreview profile={previewProfile} />
        </div>
      </div>

      <MobilePreviewSheet profile={previewProfile} />
      <AddBlockModal open={adding} onClose={() => setAdding(false)} onPick={handleAdd} />
    </div>
  );
}
