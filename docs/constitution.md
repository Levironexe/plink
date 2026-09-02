# Plink Constitution

Non-negotiable principles every spec, plan, task, and implementation must satisfy.
Derived from `docs/CONTRACT.md`, `docs/Technical_Product_Plan_VI.pdf` (§4 principles, §8 DoD), and `DESIGN.md`.
Ratified: 2026-09-03. Amend only with an explicit human decision recorded here.

## Article I — Security first

1. Every server action and API route authenticates and scopes by the owning user/workspace; cross-tenant reads or writes are defects of the highest severity.
2. LLM output is never trusted: sanitize structure, drop unknown block/effect types, allow only http(s) URLs, re-validate at the server boundary (a Server Action is a public endpoint).
3. Secrets live in env files, never in code or client bundles. Key checks happen at call time so the app boots with blank keys.
4. Uploads keep the existing MIME allowlist (no SVG/HTML), traversal-safe keys, per-user namespacing.

## Article II — Data safety (Prisma)

1. Schema changes go through the `/prisma-schema-safety` skill. No ad-hoc migrations. Never `prisma db push`.
2. Migrations are **additive with defaults**; existing rows and live pages must survive every deploy. Destructive edits to host data are forbidden.
3. Only the schema owner (one agent, sequentially) touches `schema.prisma` and runs migrations against the shared Neon database. Feature agents treat the schema as frozen and run `db:generate` only.

## Article III — Schema-first, human-in-the-loop

1. The Site Schema (site → page → section → block, theme tokens, content refs, assets) is the single source of truth; the renderer and studio are consumers, never owners.
2. AI generates **site configuration conforming to schema**, never arbitrary source code, and never writes to the database directly — it proposes; a human reviews, edits, applies.
3. Every mutation of significance is auditable (who, what, when, before/after) and reversible (rollback by default).
4. Prompts, outputs, and human edits of AI generations are recorded (plan §6) to improve the workflow.

## Article IV — Design system compliance

1. Follow `DESIGN.md`. Never hardcode colors — use the `@theme` tokens in `globals.css` (`--color-*`, `--font-*`, `--shadow-*`, `--radius-*`).
2. Weight ≤ 600 with negative display tracking; mesh gradient is the only decorative color; hairline borders; stacked low-opacity elevation.
3. Creator-facing themes stay theme-driven (`--pl-*` vars); admin/studio UI stays token-driven. `prefers-reduced-motion` disables all motion, always.

## Article V — Architecture discipline

1. Turborepo one-way dependency direction: **app → integrations → core**. `@plink/core` depends on nothing in the workspace. SDKs stay behind their package boundary.
2. Components used by one route area live in that area's `_components/`; only cross-area components are shared.
3. Effects follow the established seam: registry → CSS class, palette → CSS custom properties; static stylesheet never learns about users; ambient effects cost no JS; pointer effects write style attributes, not React state.

## Article VI — Verification

1. `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass before any merge; e2e (`test:e2e`) runs where the feature touches user flows.
2. New behavior ships with tests that pin it (contract tests for schema/vars, unit tests for logic, e2e for flows).
3. Definition of Done for the OS milestone tracks plan §8: operator can brief → first draft; responsive; AI reviewed; preview/publish/rollback; no per-client code; ≥3 distinct templates from one schema; audit log on important operations; delivery metrics recorded.

## Article VII — Process

1. Each feature runs the full speckit cycle (specify → plan → tasks → implement) with artifacts in `docs/specs/<feature>/`. Speckit is not installed; agents execute the cycle manually — no stage skipped.
2. Each feature agent works in its own git worktree on `feat/<feature>`; agents never edit the same files concurrently; shared files have a named owner.
3. Approach decisions and notable findings are documented as spikes in `docs/spikes/`.
