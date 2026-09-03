"use client";

import * as React from "react";
import { LayoutList, Plus } from "lucide-react";
import { Button } from "@plink/ui/button";
import { useToast } from "@plink/ui/toast";
import type {
  EffectTarget,
  SiteDocument,
  SitePage,
  SiteSection,
  SiteTemplateId,
} from "@plink/core/site-schema";
import type { BlockDefinition } from "@plink/core/blocks";
import { siteThemeVars } from "@/components/site/site-model";
import { useDebouncedSave } from "@/lib/hooks";
import {
  ChoiceDialog,
  ConfirmDialog,
  SECTION_KIND_CHOICES,
  SECTION_KIND_LABELS,
  SavingIndicator,
} from "./editor-chrome";
import { EffectsButton } from "./effects-button";
import { TemplateSwitcher } from "./template-switcher";
import { PageTabs } from "./page-tabs";
import { SectionCard } from "./section-card";
import { PreviewPane } from "./preview-pane";
import { PublishPanel } from "./publish-panel";
import {
  LIMITS,
  addBlock,
  addPage,
  addSection,
  moveBlock,
  moveSection,
  removeBlock,
  removePage,
  removeSection,
  renameSection,
  setEffect,
  switchDocumentTemplate,
  updateBlock,
  updatePage,
  type BlockPatch,
  type EffectScope,
} from "../_lib/document-ops";
import { saveSiteDraft, switchTemplate, type VersionRow } from "../actions";

/**
 * The studio editor. One `SiteDocument` in client state is the entire model:
 * every control produces a new document through the pure algebra in
 * `_lib/document-ops`, the preview renders that same object, and a debounced
 * `saveSiteDraft` persists it. There is no per-field endpoint and no patch
 * protocol — the document *is* the wire format (constitution III.1).
 *
 * State updates stay pure. The live document is mirrored in a ref so `apply`
 * can compute the next value, set state with a finished object and schedule the
 * save outside the updater — the shape of the bug `d9a3056` fixed in the
 * dashboard, avoided here by construction.
 */
export function SiteEditor({
  siteId,
  initialDocument,
  initialVersions,
}: {
  siteId: string;
  initialDocument: SiteDocument;
  initialVersions: VersionRow[];
}) {
  const { toast } = useToast();

  const [document, setDocument] = React.useState(initialDocument);
  const docRef = React.useRef(document);
  const [activePageId, setActivePageId] = React.useState(initialDocument.pages[0].id);
  const [expandedBlockId, setExpandedBlockId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [addingSection, setAddingSection] = React.useState(false);
  const [confirm, setConfirm] = React.useState<PendingDelete | null>(null);
  const [switchingTemplate, startTemplateSwitch] = React.useTransition();

  /* ---------------------------------------------------------------- saving */

  /**
   * Writes are serialised through one promise chain, and each one checks
   * whether the document it carries has already been stored. Two things fall
   * out of that: drafts can never land out of order, and awaiting `persist`
   * before a publish waits for *every* queued write — including one the
   * debounce fired a millisecond earlier — so a snapshot is never older than
   * the screen.
   */
  const savedRef = React.useRef(initialDocument);
  const queue = React.useRef<Promise<void>>(Promise.resolve());

  const persist = React.useCallback(
    (next: SiteDocument) => {
      queue.current = queue.current.then(async () => {
        if (savedRef.current === next) return;
        try {
          const result = await saveSiteDraft(siteId, next);
          if (result.ok) savedRef.current = next;
          else toast(result.error, "error");
          // Still "Saving…" if the operator has typed since — a newer write is coming.
          if (docRef.current === next || !result.ok) setSaving(false);
        } catch {
          setSaving(false);
          toast("Could not save the draft", "error");
        }
      });
      return queue.current;
    },
    [siteId, toast],
  );

  const save = useDebouncedSave<SiteDocument>(persist);

  /**
   * The single write path. Reading the next document from the ref (rather than
   * state) lets several calls in one tick compose, and returning early on an
   * unchanged document means a no-op op costs neither a render nor a save.
   */
  const apply = React.useCallback(
    (op: (doc: SiteDocument) => SiteDocument) => {
      const next = op(docRef.current);
      if (next === docRef.current) return;
      docRef.current = next;
      setDocument(next);
      setSaving(true);
      save.schedule(next);
    },
    [save],
  );

  /* ------------------------------------------------------------ derivation */

  /**
   * Derived, never synced. `activePageId` can point at a page that no longer
   * exists — the fallback resolves it to the first page and everything else in
   * the editor reads `activePage.id`, so no effect is needed to repair the
   * selection after a delete.
   */
  const activePage: SitePage =
    document.pages.find((page) => page.id === activePageId) ?? document.pages[0];

  const palette = React.useMemo(
    () => siteThemeVars(document.theme) as React.CSSProperties,
    [document.theme],
  );

  const pageScope: EffectScope = { level: "page", pageId: activePage.id };
  const sectionsFull = activePage.sections.length >= LIMITS.sectionsPerPage;

  /* --------------------------------------------------------------- actions */

  function handleTemplate(template: SiteTemplateId) {
    // Locally first so the preview flips immediately, then through the
    // dedicated action, which re-reads the stored draft and patches only
    // `template`. Both writes carry the same value, in either order, so a
    // switch racing a keystroke converges instead of clobbering.
    apply((doc) => switchDocumentTemplate(doc, template));
    startTemplateSwitch(async () => {
      const result = await switchTemplate(siteId, template);
      if (!result.ok) toast(result.error, "error");
    });
  }

  function handleAddPage(kind: SitePage["kind"]) {
    const before = docRef.current.pages.map((page) => page.id);
    apply((doc) => addPage(doc, kind));
    const added = docRef.current.pages.find((page) => !before.includes(page.id));
    if (added) setActivePageId(added.id);
    else toast(`A site holds at most ${LIMITS.pages} pages`, "error");
  }

  function handleAddSection(kind: SiteSection["kind"]) {
    apply((doc) => addSection(doc, activePage.id, kind));
  }

  function handleAddBlock(sectionId: string, definition: BlockDefinition) {
    apply((doc) => addBlock(doc, activePage.id, sectionId, definition));
  }

  function handleEffect(scope: EffectScope, target: EffectTarget, id: string | undefined) {
    apply((doc) => setEffect(doc, scope, target, id));
  }

  function handleBlockChange(sectionId: string, blockId: string, patch: BlockPatch) {
    apply((doc) => updateBlock(doc, activePage.id, sectionId, blockId, patch));
  }

  function runConfirmed() {
    if (!confirm) return;
    if (confirm.kind === "page") {
      apply((doc) => removePage(doc, confirm.pageId));
      // Land on a page that still exists rather than relying on the fallback.
      setActivePageId(docRef.current.pages[0].id);
      setExpandedBlockId(null);
    }
    if (confirm.kind === "section") apply((doc) => removeSection(doc, confirm.pageId, confirm.sectionId));
    if (confirm.kind === "block") {
      apply((doc) => removeBlock(doc, confirm.pageId, confirm.sectionId, confirm.blockId));
    }
    setConfirm(null);
  }

  /* ----------------------------------------------------------------- chrome */

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <SavingIndicator saving={saving} />
        <EffectsButton
          level="site"
          label="the whole site"
          effects={document.effects}
          palette={palette}
          onChange={(target, id) => handleEffect({ level: "site" }, target, id)}
        />
        <PublishPanel
          siteId={siteId}
          initialVersions={initialVersions}
          beforePublish={async () => {
            // Flush the debounce, then wait for the whole write queue to drain.
            save.flush();
            await persist(docRef.current);
          }}
        />
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="card p-4">
            <p className="eyebrow mb-2 uppercase">template</p>
            <TemplateSwitcher
              value={document.template}
              pending={switchingTemplate}
              onChange={handleTemplate}
            />
          </section>

          <PageTabs
            document={document}
            activePageId={activePage.id}
            palette={palette}
            onSelect={(pageId) => {
              setActivePageId(pageId);
              setExpandedBlockId(null);
            }}
            onAdd={handleAddPage}
            onUpdate={(patch) => apply((doc) => updatePage(doc, activePage.id, patch))}
            onDelete={() =>
              setConfirm({
                kind: "page",
                pageId: activePage.id,
                name: activePage.title || activePage.path,
              })
            }
            onEffect={(target, id) => handleEffect(pageScope, target, id)}
          />

          {activePage.sections.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-canvas px-6 py-12 text-center">
              <LayoutList className="size-5 text-ink-muted" aria-hidden />
              <p className="mt-3 max-w-sm text-[14px] leading-5 tracking-[-0.02em] text-ink-soft">
                This page has no sections yet. Add a hero to open it, then the sections the
                content needs.
              </p>
              <div className="mt-5">
                <Button onClick={() => setAddingSection(true)}>
                  <Plus className="size-4" aria-hidden /> Add section
                </Button>
              </div>
            </div>
          ) : (
            activePage.sections.map((section, index) => (
              <SectionCard
                key={section.id}
                section={section}
                index={index}
                count={activePage.sections.length}
                palette={palette}
                expandedBlockId={expandedBlockId}
                onExpandBlock={setExpandedBlockId}
                onRename={(title) => apply((doc) => renameSection(doc, activePage.id, section.id, title))}
                onMove={(delta) => apply((doc) => moveSection(doc, activePage.id, section.id, delta))}
                onDelete={() =>
                  setConfirm({
                    kind: "section",
                    pageId: activePage.id,
                    sectionId: section.id,
                    name: section.title || SECTION_KIND_LABELS.get(section.kind) || section.kind,
                  })
                }
                onEffect={(target, id) =>
                  handleEffect({ level: "section", pageId: activePage.id, sectionId: section.id }, target, id)
                }
                onAddBlock={(definition) => handleAddBlock(section.id, definition)}
                onBlockChange={(blockId, patch) => handleBlockChange(section.id, blockId, patch)}
                onBlockMove={(blockId, delta) =>
                  apply((doc) => moveBlock(doc, activePage.id, section.id, blockId, delta))
                }
                onBlockDelete={(blockId) =>
                  setConfirm({
                    kind: "block",
                    pageId: activePage.id,
                    sectionId: section.id,
                    blockId,
                    name:
                      section.blocks.find((block) => block.id === blockId)?.title || "this block",
                  })
                }
                onBlockEffect={(blockId, target, id) =>
                  handleEffect(
                    { level: "block", pageId: activePage.id, sectionId: section.id, blockId },
                    target,
                    id,
                  )
                }
              />
            ))
          )}

          {activePage.sections.length > 0 && (
            <Button
              variant="ghost"
              onClick={() => setAddingSection(true)}
              disabled={sectionsFull}
              className="justify-center border border-dashed border-line py-5"
            >
              <Plus className="size-4" aria-hidden />
              {sectionsFull ? `Page is full (${LIMITS.sectionsPerPage} sections)` : "Add section"}
            </Button>
          )}
        </div>

        <div className="min-w-0 xl:sticky xl:top-6 xl:h-[calc(100dvh-6rem)]">
          <PreviewPane document={document} path={activePage.path} />
        </div>
      </div>

      <ChoiceDialog
        open={addingSection}
        onClose={() => setAddingSection(false)}
        title="Add a section"
        description={`Onto the ${activePage.title || activePage.path} page.`}
        choices={SECTION_KIND_CHOICES}
        onPick={handleAddSection}
      />

      <ConfirmDialog
        open={confirm !== null}
        title={CONFIRM_TITLES[confirm?.kind ?? "block"]}
        description={
          confirm
            ? `"${confirm.name}" and everything inside it is removed from the draft. Published versions are untouched — publish again to make the removal live.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        onConfirm={runConfirmed}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}

/** What the confirm dialog is about to remove, with enough address to do it. */
type PendingDelete =
  | { kind: "page"; pageId: string; name: string }
  | { kind: "section"; pageId: string; sectionId: string; name: string }
  | { kind: "block"; pageId: string; sectionId: string; blockId: string; name: string };

const CONFIRM_TITLES: Record<PendingDelete["kind"], string> = {
  page: "Delete this page?",
  section: "Delete this section?",
  block: "Delete this block?",
};
