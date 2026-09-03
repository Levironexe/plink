# Plan — feat/workspaces-brief

## Approach

Everything hangs off two seams that already exist in the codebase:

1. **Auth seam** — `@/lib/auth` (`getSessionUserId`, `getCurrentUser`) is the
   only session source. `lib/workspace.ts` builds the tenancy guards on top of
   it and is the single ownership chokepoint every action, page, and API route
   goes through.
2. **Action seam** — `dashboard/actions.ts` established `ActionResult<T>` +
   throw-on-unauthenticated. `studio/actions.ts` copies the shape verbatim so
   Features E/F consume a familiar contract.

### File layout

```
apps/web/src/lib/workspace.ts              guards + pure slug/brief helpers
apps/web/src/app/studio/
  actions.ts                               createWorkspace/createSite/saveBrief/submitBrief
  page.tsx                                 server page: workspaces + sites
  _components/
    workspace-create-form.tsx              client; empty-state + inline create
    new-site-form.tsx                      client; modal with template picker
    site-card.tsx                          server presentational card
  brief/[siteId]/
    page.tsx                               server page: ownership check + load
    _components/brief-form.tsx             client; full BriefData form
apps/web/src/app/api/workspaces/route.ts   GET list
apps/web/tests/unit/workspace.test.ts      pure pieces + guards (mocked prisma)
```

### Key decisions (spike: `docs/spikes/2026-09-03-workspace-guards-and-slugs.md`)

- **Pure helpers live in `lib/workspace.ts`** next to the guards (ownership
  list allows no other lib file). Tests mock `@/lib/auth` and `@plink/db`
  before importing, which keeps `server-only` out of the vitest graph.
- **Slugs**: own `baseSlug` + `uniqueSlug(base, isTaken)` rather than reusing
  `slugifyUsername` (dots/underscores, 30-char cap — username semantics, not
  slug semantics). `uniqueSlug` takes an `isTaken` predicate so it is pure and
  the DB probe is injected.
- **Guards throw `FORBIDDEN` for "not found" too** — a 404/403 distinction
  would leak row existence across tenants (constitution Art. I).
- **No `studio/layout.tsx`** — Feature E owns `studio/[siteId]/**`; a shared
  layout would couple the two agents. Each page does its own
  `redirect("/login")`, exactly like `/dashboard` pages do individually.
- **Brief JSON round-trip**: pages parse `Brief.data` through
  `briefSchema` with `emptyBrief()` fallback, so a corrupt row can never break
  the form; actions re-validate on the way in (Server Action = public
  endpoint).

### Data flow

- `/studio` (server) → `prisma.workspace.findMany({ where: { ownerId } , include sites + brief status })` → cards.
- Create flows → server actions → `revalidatePath("/studio")`.
- Brief page (server) → ownership check → parsed `BriefData` → `BriefForm`
  (client, local state) → `saveBrief`/`submitBrief` → `router.refresh()`.

### Audit

Direct `prisma.auditLog.create` in each action, action strings frozen:
`workspace.create`, `site.create`, `brief.save`, `brief.submit`. `after`
carries a compact JSON summary (never secrets), `siteId` set where a site is
involved. Feature D's `writeAudit` helper replaces the call sites later
without changing rows.

## Risks

- **Slug races**: two concurrent creates could pass `isTaken` then collide on
  the unique index. Accepted for V0 — the create returns the Prisma error as a
  friendly `ActionResult` failure and the user retries.
- **Toast provider absent** under `/studio` (it lives in the dashboard
  layout). Forms surface inline status text instead of `useToast`.

## Verification

- `pnpm --filter @plink/web typecheck && lint && test`.
- Unit tests pin: slug base/collision behavior, template fallback, brief
  validation glue, guard auth matrix (no session / not owner / owner).
