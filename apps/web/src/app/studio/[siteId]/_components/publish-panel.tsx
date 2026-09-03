"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { History, Rocket, RotateCcw } from "lucide-react";
import { Button } from "@plink/ui/button";
import { Modal } from "@plink/ui/modal";
import { TextField } from "@plink/ui/field";
import { useToast } from "@plink/ui/toast";
import { cn } from "@plink/core/utils";
import { ConfirmDialog, formatVersionDate } from "./editor-chrome";
import { publish, rollback, versions as listVersionRows, type VersionRow } from "../actions";

/**
 * Publish and version history — the operator's approval seat.
 *
 * The store makes both halves safe: publishing snapshots the *stored* draft
 * into an immutable `SiteVersion`, and rolling back copies an old snapshot
 * forward as a brand-new version rather than rewinding history (constitution
 * III.3). So this component never sends a document; it sends an intent, and
 * re-reads the history afterwards.
 *
 * `beforePublish` flushes the editor's pending autosave first — a snapshot that
 * lagged the screen would be the one bug an operator could never explain.
 */
export function PublishPanel({
  siteId,
  initialVersions,
  beforePublish,
  historyOnly,
}: {
  siteId: string;
  initialVersions: VersionRow[];
  beforePublish?: () => Promise<void> | void;
  /** Drops the Publish control — the draft recovery card has nothing valid to publish. */
  historyOnly?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = React.useState(initialVersions);
  const [publishing, setPublishing] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [confirmTarget, setConfirmTarget] = React.useState<VersionRow | null>(null);
  const [pending, startTransition] = React.useTransition();

  const live = rows.find((row) => row.isPublished);

  async function refreshVersions() {
    const result = await listVersionRows(siteId);
    if (result.ok && result.data) setRows(result.data);
  }

  function handlePublish() {
    startTransition(async () => {
      await beforePublish?.();
      const result = await publish(siteId, note);
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      setPublishing(false);
      setNote("");
      toast(`Published v${result.data?.versionNumber}`);
      await refreshVersions();
      router.refresh();
    });
  }

  function handleRollback(row: VersionRow) {
    startTransition(async () => {
      const result = await rollback(siteId, row.number);
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      setConfirmTarget(null);
      setHistoryOpen(false);
      toast(`Restored v${row.number} as v${result.data?.versionNumber}`);
      await refreshVersions();
      // The draft is now the restored snapshot — reload so the editor's state
      // is the document the server actually holds, not the one we replaced.
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        onClick={() => {
          setHistoryOpen(true);
          void refreshVersions();
        }}
      >
        <History className="size-4" aria-hidden />
        History
        {rows.length > 0 && <span className="text-ink-muted">{rows.length}</span>}
      </Button>

      {!historyOnly && (
        <Button size="md" onClick={() => setPublishing(true)}>
          <Rocket className="size-4" aria-hidden />
          Publish
        </Button>
      )}

      <Modal
        open={publishing}
        onClose={() => setPublishing(false)}
        title="Publish this site"
        description={
          live
            ? `The current draft becomes the live version. v${live.number} stays in history and can be restored.`
            : "The current draft becomes the first published version."
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPublishing(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={handlePublish} loading={pending}>
              Publish
            </Button>
          </>
        }
      >
        <TextField
          label="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="What changed in this version?"
          hint="Shown in the version history so a future rollback has context."
        />
      </Modal>

      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Version history"
        description="Every publish is an immutable snapshot. Restoring one copies it forward as a new version — history is never rewritten."
        size="md"
      >
        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-line bg-canvas px-4 py-8 text-center text-[14px] leading-5 text-ink-soft">
            Nothing published yet. The first publish creates v1.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-md border p-3",
                  row.isPublished ? "border-brand-100 bg-brand-50" : "border-line bg-surface",
                )}
              >
                <span className="eyebrow shrink-0 rounded-full border border-line bg-canvas px-2 py-0.5">
                  v{row.number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] tracking-[-0.02em] text-ink">
                    {row.note || "No note"}
                  </span>
                  <span className="block text-[12px] leading-4 text-ink-muted">
                    {formatVersionDate(row.createdAt)}
                  </span>
                </span>
                {row.isPublished ? (
                  <span className="shrink-0 text-[12px] font-medium tracking-[-0.01em] text-brand-600">
                    Live
                  </span>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => setConfirmTarget(row)}>
                    <RotateCcw className="size-3.5" aria-hidden />
                    Rollback
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmTarget !== null}
        title={`Roll back to v${confirmTarget?.number}?`}
        description={`The draft you are editing is replaced by the v${confirmTarget?.number} snapshot and published as a new version. Your current unpublished edits are not kept.`}
        confirmLabel="Roll back"
        destructive
        pending={pending}
        onConfirm={() => confirmTarget && handleRollback(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
      />
    </>
  );
}
