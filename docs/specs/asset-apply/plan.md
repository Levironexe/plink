# Plan — feat/asset-apply

Implementation approach for `docs/specs/asset-apply/spec.md`.

## Layering

```
assets/page.tsx (server)
   requireSite ──> site.document ──safeParseSiteDocument──> imageTargets(doc)
        │                                                        │ data
        └─ _components/asset-studio.tsx (client) <───────────────┘
                 │  server action
                 ▼
        assets/actions.ts   "use server"
                 ├─ isAssetTarget / safeHttpUrl        (re-validate the boundary)
                 ├─ getSiteForUser                     (@/lib/site-store — ownership)
                 ├─ applyAssetToDocument               (assets/_lib — pure)
                 ├─ saveDraft                          (@/lib/site-store — validates + writes)
                 └─ writeAudit / logEvent + revalidatePath
```

The pure layer knows nothing about React, Prisma or `next`; the action layer
owns every guard; the client layer owns nothing but the select and the toast.
That split is what lets the whole placement algebra be pinned by
`tests/unit/asset-apply.test.ts` with no DOM and no database.

## Key decisions

1. **A second module, not a bigger `document-ops`.** `_lib/document-ops.ts`
   belongs to the editor route and this branch must not edit it. The placement
   rules are also a different kind of thing — the editor's ops are *addressed*
   (`pageId, sectionId, blockId` all supplied by a UI that is already showing
   the tree), while this one is *searching* on behalf of a UI that only knows a
   URL. `LIMITS` is imported from it so the caps live in exactly one place.
2. **The same no-op discipline, deliberately reused.** Returning the input
   object on an unresolved address is what lets the action distinguish "you
   placed it" from "that placement is gone" without a second lookup, and it is
   the convention every reader of `document-ops` already knows.
3. **Hero placement targets an image-capable block.** The one deviation from
   the branch brief; evidence in the spike, restated in the spec. It is the
   difference between the feature working and the feature reporting that it
   worked.
4. **`safeHttpUrl` is imported from `@plink/ai`, not re-written.** It is the
   same "http(s) only, no `data:`, no protocol-relative, byte-for-byte
   preserved" rule the generator already applies to every URL entering a
   document (Art. I.2). The 600-char clamp on top of it is the schema's
   `imageUrl` bound.
5. **The audit row is written by this action, not by `saveDraft`.**
   `saveDraft` writes its own `site.save` row with a document diff; `asset.apply`
   adds *why* the document changed (which URL, which placement). Both rows are
   wanted — the diff proves what moved, the apply row proves who asked for it.
6. **Targets are computed on the server, passed as data.** The client never
   parses a document, so the schema (and `zod`) stay out of that bundle, exactly
   as `ASSET_KINDS` is passed down rather than imported.
7. **A native `<select>` with `<optgroup>`s.** Two placement families with a
   handful of entries each; a listbox is what the platform already ships,
   keyboard- and screen-reader-complete, and `.field` makes it match the panel.
   "No new dependency" is a hard rule and it costs nothing here.
8. **The panel mounts its own `ToastProvider`.** `/studio` has no layout to hold
   one and this branch cannot add one; spike §5.

## Risks

| Risk | Handling |
| --- | --- |
| Operator's target list is stale (another tab deleted the block) | The apply resolves ids against the freshly-read draft; an unresolved address returns the input document, which the action reports as "That placement no longer exists" rather than writing a silent no-op. |
| The apply races the editor's autosave in another tab | Unchanged from the rest of the studio: last write wins on the draft, and `saveDraft`'s audit diff records both. Nothing is published, so the live site cannot be affected. |
| A stored draft that no longer parses | The page renders an empty target list and a disabled control with a reason; the action refuses with the store's message instead of throwing. |
| Placing an image where no template paints it | The hero rule inserts a block that does paint; the block list only offers fields the renderer reads. |
| Hero on a page already at 24 sections / 40 blocks | Both caps are checked against `LIMITS`; over the cap the op is a no-op and the operator is told, rather than `saveDraft` refusing an oversized document. |
| `imageUrl` longer than the schema's 600 chars | Rejected at the boundary with its own message; a blob URL is nowhere near it. |

## Sequence

Spike → spec/plan/tasks → pure helper → unit tests → server action → UI → full
gate. One commit per boundary.
