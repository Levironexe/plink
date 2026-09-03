"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@plink/ui/button";
import { Modal } from "@plink/ui/modal";
import { cn } from "@plink/core/utils";
import type { SitePage, SiteSection } from "@plink/core/site-schema";

/**
 * Studio-editor chrome: the handful of controls the page / section / block
 * rows all need. Admin surface only — every colour comes from a `DESIGN.md`
 * token and the `.card` / `.field` / `.eyebrow` primitives (constitution IV.1).
 * Nothing here knows what a site document is; it is all buttons and dialogs.
 */

/** A compact square icon control — the row-level verb (move, delete, effects). */
export function IconButton({
  label,
  onClick,
  disabled,
  destructive,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors",
        "disabled:pointer-events-none disabled:opacity-35",
        active
          ? "border-ink bg-ink text-white"
          : destructive
            ? "border-line bg-surface text-ink-muted hover:border-danger-soft hover:bg-danger-soft/40 hover:text-danger-deep"
            : "border-line bg-surface text-ink-muted hover:border-line-strong/50 hover:bg-canvas-deep hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Reorder without a drag-and-drop dependency. Two buttons are keyboard- and
 * screen-reader-accessible by construction, which a pointer-driven drag list
 * only becomes with a great deal of extra wiring.
 */
export function MoveButtons({
  what,
  onMove,
  atStart,
  atEnd,
}: {
  what: string;
  onMove: (delta: number) => void;
  atStart: boolean;
  atEnd: boolean;
}) {
  return (
    <>
      <IconButton label={`Move ${what} up`} onClick={() => onMove(-1)} disabled={atStart}>
        <ChevronUp className="size-4" aria-hidden />
      </IconButton>
      <IconButton label={`Move ${what} down`} onClick={() => onMove(1)} disabled={atEnd}>
        <ChevronDown className="size-4" aria-hidden />
      </IconButton>
    </>
  );
}

/** The "Saving…" label from the dashboard page editor, same fade, same politeness. */
export function SavingIndicator({ saving }: { saving: boolean }) {
  return (
    <span
      aria-live="polite"
      className={cn(
        "text-[13px] font-medium tracking-[-0.01em] transition-opacity duration-200",
        saving ? "text-ink-muted opacity-100" : "opacity-0",
      )}
    >
      Saving…
    </span>
  );
}

/** Deletes and rollbacks are irreversible from the operator's seat — always ask. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive,
  pending,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {/* The question is the description; the dialog needs no body of its own. */}
      {null}
    </Modal>
  );
}

export type Choice<T extends string> = {
  id: T;
  label: string;
  blurb?: string;
  icon?: LucideIcon;
  /** Optional heading the choice is filed under; ungrouped choices render first. */
  group?: string;
};

/**
 * One picker for the three "what kind?" moments — page kind, section kind and
 * block type. They differ only in their options, so they share a dialog rather
 * than three near-identical grids.
 */
export function ChoiceDialog<T extends string>({
  open,
  onClose,
  title,
  description,
  choices,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  choices: ReadonlyArray<Choice<T>>;
  onPick: (id: T) => void;
}) {
  const groups = [...new Set(choices.map((choice) => choice.group ?? ""))];

  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="lg">
      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <section key={group}>
            {group && <p className="eyebrow mb-2 uppercase">{group}</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              {choices
                .filter((choice) => (choice.group ?? "") === group)
                .map((choice) => {
                  const Icon = choice.icon;
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      onClick={() => {
                        onPick(choice.id);
                        onClose();
                      }}
                      className="flex items-start gap-3 rounded-md border border-line bg-surface p-3 text-left transition-colors hover:border-line-strong/50 hover:bg-canvas-deep"
                    >
                      {Icon && (
                        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border border-line bg-canvas text-ink-muted">
                          <Icon className="size-4" aria-hidden />
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block text-[14px] font-medium tracking-[-0.02em] text-ink">
                          {choice.label}
                        </span>
                        {choice.blurb && (
                          <span className="mt-0.5 block text-[12.5px] leading-4 text-ink-muted">
                            {choice.blurb}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------- vocabulary */

/** Operator-facing names for the schema's page kinds. */
export const PAGE_KIND_CHOICES: ReadonlyArray<Choice<SitePage["kind"]>> = [
  { id: "bio", label: "Bio", blurb: "Who they are, links and socials." },
  { id: "shop", label: "Shop", blurb: "Products, prices and offers." },
  { id: "blog", label: "Blog", blurb: "Posts, updates and announcements." },
  { id: "custom", label: "Custom", blurb: "An empty page to build from scratch." },
];

/** Operator-facing names for the schema's section kinds, in `SECTION_KINDS` order. */
export const SECTION_KIND_CHOICES: ReadonlyArray<Choice<SiteSection["kind"]>> = [
  { id: "hero", label: "Hero", blurb: "The masthead — name, tagline, first call to action." },
  { id: "links", label: "Links", blurb: "A stack of destinations." },
  { id: "products", label: "Products", blurb: "What is for sale." },
  { id: "posts", label: "Posts", blurb: "Writing and updates." },
  { id: "gallery", label: "Gallery", blurb: "Images and work." },
  { id: "faq", label: "FAQ", blurb: "The questions that always come up." },
  { id: "contact", label: "Contact", blurb: "How to get in touch." },
  { id: "custom", label: "Custom", blurb: "Anything else." },
];

export const SECTION_KIND_LABELS = new Map(
  SECTION_KIND_CHOICES.map((choice) => [choice.id, choice.label]),
);

export const PAGE_KIND_LABELS = new Map(PAGE_KIND_CHOICES.map((choice) => [choice.id, choice.label]));

/** `2026-09-03, 14:20` in the viewer's locale — versions are timestamps, not prose. */
export function formatVersionDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}
