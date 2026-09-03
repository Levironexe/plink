# Spec — feat/workspaces-brief

The agency layer of the Creator Website OS (Product Plan VI V0): workspaces per
operator, client sites inside workspaces, and a structured brief intake that
feeds the AI website generator (Feature F) later.

## Problem

An operator (agency or solo creator running client work) needs a place to
group client sites, spin up a new site from a template, and collect a
structured brief from/about the client before any site content exists. Today
Plink only knows single-user bio pages under `/dashboard`.

## Users and scope

- **Operator** — the authenticated Plink user. Owns workspaces; every read and
  write is scoped to `workspace.ownerId === session user` (constitution Art. I).
- Out of scope: multi-member workspaces, client logins, the site editor
  (`/studio/[siteId]`, Feature E), AI generation (Feature F), publish/rollback
  (Feature D).

## Functional requirements

### FR1 — Tenancy guards (`apps/web/src/lib/workspace.ts`)

- `requireWorkspace(workspaceId)` → `{ workspace: { id, ownerId, name, slug }, userId }`.
  Throws `Error("UNAUTHENTICATED")` when there is no session; throws
  `Error("FORBIDDEN")` when the workspace does not exist **or** is not owned by
  the current user (not-found and not-owned are indistinguishable — no
  existence leak).
- `requireSite(siteId)` → `{ site: Site, userId }` with the same rules,
  ownership resolved through `site.workspace.ownerId`.

### FR2 — Server actions (`apps/web/src/app/studio/actions.ts`, `"use server"`)

All return `ActionResult<T>` (`{ ok: true; data? } | { ok: false; error; field? }`),
shape copied from `dashboard/actions.ts`. Auth failures throw (same as the
dashboard's `requireUserId` pattern); validation failures return `{ ok: false }`.

- `createWorkspace(name)` — non-empty name (≤ 120 chars); slug slugified from
  the name, numeric suffix (`-2`, `-3`, …) on collision; audit
  `workspace.create`.
- `createSite(workspaceId, { name, template, clientName?, clientEmail? })` —
  ownership via `requireWorkspace`; template validated against
  `SITE_TEMPLATES` with fallback `"editorial"`; unique site slug from name;
  `document = JSON.stringify(emptySiteDocument(template))`; an empty `Brief`
  row (`emptyBrief()` JSON, status `draft`) created in the same transaction;
  audit `site.create`.
- `saveBrief(siteId, data: unknown)` — ownership via `requireSite`; payload
  gated by `briefSchema` (`{ ok: false, error }` on invalid — a Server Action
  is a public endpoint); stores JSON in `Brief.data`, sets status `"draft"`;
  audit `brief.save`.
- `submitBrief(siteId)` — ownership via `requireSite`; sets `Brief.status`
  `"submitted"`; audit `brief.submit`.

Audit writes are direct `prisma.auditLog.create({ data: { userId, siteId?, action, after? } })`
with exactly the action strings above (Feature D's helper lands later and must
find identical strings).

### FR3 — `/studio` page

- Unauthenticated visits redirect to `/login` (same as `/dashboard` pages).
- Lists the current user's workspaces; a create-workspace form (empty state
  when none exist).
- Per workspace: site cards showing name, template, status badge, client name;
  each card links to `/studio/${site.id}` (Feature E's editor — may 404 for
  now) and `/studio/brief/${site.id}`; brief status is surfaced on the card.
- "New site" flow per workspace: name, template picker (the three
  `SITE_TEMPLATES`), optional client name/email.

### FR4 — `/studio/brief/[siteId]` page

- Ownership-checked server-side; unauthenticated → `/login`; not owned / not
  found → 404.
- Brief intake form covering **every** `BriefData` field: business name,
  tagline, description, category, tone select (5 tones), pages multi-select
  (bio/shop/blog), products repeater (≤ 20: name, price, description), links
  repeater (≤ 20: label, url), socials repeater (≤ 10: platform, url), brand
  colors (two color inputs: primary, accent), contact email.
- Save (draft) and Submit buttons wired to `saveBrief` / `submitBrief`; a
  visible submitted state after submission. Saving again returns the brief to
  draft (the contract's status semantics).

### FR5 — API (`apps/web/src/app/api/workspaces/route.ts`)

- `GET` → `{ workspaces: [{ id, name, slug, sites: [{ id, name, slug, template, status }] }] }`
  for the current user; `401` when unauthenticated.

## Non-functional requirements

- Admin UI uses DESIGN.md tokens only (`--color-*` via Tailwind theme names,
  `.field`, `.field-label`, `.card`, `.eyebrow`); no hardcoded colors;
  `PageHeader` / `EmptyState` / `@plink/ui` primitives reused.
- Prisma schema is frozen; `pnpm db:generate` only.
- No new npm dependencies.
- Unit tests (`apps/web/tests/unit/workspace.test.ts`) cover the pure pieces:
  slug generation + collision suffixing, brief validation glue, template
  fallback, and the tenancy guards with `vi.mock`ed `@plink/db` / auth. No
  database access in tests.

## Definition of done

`pnpm --filter @plink/web typecheck && lint && test` green, all work committed
on `feat/workspaces-brief`, DoD item "Operator: project + brief" satisfied up
to the generator hand-off.
