# Spike — tenancy guard shape, slug strategy, brief status semantics

Feature: `feat/workspaces-brief`. Decisions taken before implementation;
recorded per constitution Art. VII.3.

## 1. Guards throw FORBIDDEN for "not found"

`requireWorkspace` / `requireSite` throw `Error("FORBIDDEN")` both when the
row does not exist and when it belongs to another user. Distinguishing the two
(404 vs 403) would let an authenticated attacker enumerate which cuids exist
across tenants. The public contract only names UNAUTHENTICATED and FORBIDDEN,
so collapsing not-found into FORBIDDEN is the safe reading (Art. I.1).
UI pages that need a 404 (the brief route) do their own scoped lookup and call
`notFound()` — same indistinguishability, friendlier page.

## 2. Pure helpers live in `lib/workspace.ts`, tests mock the seams

The ownership list allows exactly one lib file, so the pure pieces (slugs,
template fallback, brief validation glue) sit next to the guards. The vitest
file mocks `@/lib/auth` and `@plink/db` **before** importing the module, which
keeps `server-only` and the Prisma client out of the test graph entirely —
the established pattern from `tokens.test.ts`. No database in tests.

## 3. Own slug helper instead of `slugifyUsername`

`@plink/core/utils.slugifyUsername` encodes *username* policy: it permits
dots/underscores/dashes, caps at 30, and pairs with a reserved-name list.
Workspace/site slugs are URL path segments with different needs (dash-only,
longer cap, deterministic fallback noun for symbol-only names). Reusing the
username helper would couple two policies that will evolve separately, so
`baseSlug` (48-char cap, `site`/`workspace` fallback) lives in
`lib/workspace.ts`.

Collision handling: `uniqueSlug(base, isTaken)` probes `base`, `base-2`,
`base-3`, … with an injected predicate (pure, unit-testable; the DB probe is a
`findUnique` on the unique slug column). A create that still loses the
check-then-insert race hits the unique index; the action maps Prisma `P2002`
to a friendly `ActionResult` error instead of a 500. A serializable
transaction or advisory lock would close the race completely but is not worth
the cost at V0 traffic.

## 4. Brief status: saving always returns to draft

`saveBrief` sets `status: "draft"` unconditionally (contract wording). So a
submitted brief that gets edited and saved visibly reopens as draft, and the
form's Submit button performs save-then-submit so submission always captures
the latest edits. `submitBrief` upserts (creating an empty brief if the row
was somehow lost) rather than failing — the row is an intake artifact, not a
precondition.

## 5. No `studio/layout.tsx`

Feature E owns `studio/[siteId]/**`; a layout written by C would silently wrap
E's routes and become a shared file with no named owner (Art. VII.2). Each
studio page therefore does its own `redirect("/login")`, exactly how the
dashboard pages guard individually. Studio-local `PageHeader`/`EmptyState`/
`StatusBadge` copies live in `studio/_components/primitives.tsx` (Art. V.2:
single-area components stay in the area; E may promote them later).
