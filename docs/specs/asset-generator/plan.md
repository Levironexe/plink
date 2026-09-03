# Plan — feat/asset-generator

Implementation approach for `docs/specs/asset-generator/spec.md`.

## Layering

```
studio page (server)  ──requireSite──> prisma.asset (read)
        │
        └─ _components/asset-studio.tsx (client)
                 │  fetch
                 ▼
        /api/assets  ──requireSite──┐
                 │                  ├─ generateAssetImage()  → bytes  (@plink/ai)
                 │                  ├─ putObject()           → url    (@plink/storage)
                 │                  ├─ prisma.asset.create()
                 │                  └─ writeAudit / logEvent (@/lib/site-store)
```

`@plink/ai` knows about the AI SDK and nothing else — no storage, no prisma, no
`next`. The route is the only place the three integrations meet, which keeps
Article V.1's direction intact and keeps the package unit-testable with a single
`vi.mock("ai")`.

## Key decisions

1. **`generateImage`, not `experimental_generateImage`.** Verified against the
   installed `ai@7.0.70` on disk; recorded with the model choice and the
   failure-mode policy in
   `docs/spikes/2026-09-03-ai-sdk-image-generation.md`.
2. **Bytes out of the package, upload in the route.** Sanctioned change to
   `GeneratedAsset`; the stub had no callers. Justified in the spike and the
   spec.
3. **Reuse, do not re-derive, the upload discipline.** `userPrefix` and
   `slugifyFilename` come from `@plink/storage` (import only). The site segment
   is the one piece those helpers do not cover, so it is scrubbed to
   `[A-Za-z0-9_-]` locally — the same rule `safeSegment` applies to user ids.
4. **`storeErrorResponse` is reused** from `api/sites/store-errors.ts` rather
   than re-implemented, so `UNAUTHENTICATED`/`FORBIDDEN` map identically
   everywhere.
5. **Two rate-limit windows**, mirroring `/api/upload`: one per IP before the
   session is touched, one per account after — image generation costs money as
   well as storage.
6. **No local `actions.ts`.** The client talks to `/api/assets` directly; a
   server action would duplicate the same guards for no gain. (The spec allows
   one; it is not needed.)
7. **Aspect ratio, not size.** The default model takes `aspectRatio`, so the
   kind table stays a two-column mapping instead of a per-model size matrix.

## Risks

| Risk | Handling |
| --- | --- |
| Gateway account has no image-model entitlement | `generateAssetImage` rethrows one clear sentence naming the model; route → 502; page shows it inline. Operator can repoint `AI_IMAGE_MODEL` without a deploy. |
| Model returns an unexpected media type | Allowlist check before upload; anything else is refused, so `image/svg+xml` can never be written (I.4). |
| Very large generated image | `MAX_IMAGE_BYTES` (8 MB) checked before `putObject`. |
| Blob token missing but AI key present | Checked before spending a generation call, not after. |
| New `[siteId]` dynamic segment under `/studio` | `studio/brief/[siteId]` is a static-first sibling; Next resolves `brief` before the dynamic segment, so the existing route is unaffected. |

## Sequence

Spike → spec/plan/tasks → package + tests → route → studio page → full gate.
Commit at each of those boundaries.
