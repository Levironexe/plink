# Plink

A production-grade **link-in-bio creator platform** — a full working replica of the
[Beacons.ai](https://beacons.ai) product surface, built from scratch with Next.js 16,
React 19, Tailwind CSS v4 and Prisma 7.

It is not a landing-page clone. Every screen is backed by real data: you can sign up,
onboard, build a page block by block, theme it, sell products, collect email
subscribers, publish a media kit, and watch the analytics fill in.

---

## What's in it

### Marketing site
| Route | What it does |
| --- | --- |
| `/` | Hero with live username claim, feature bento, four product deep-dives, template marquee, testimonials, pricing, FAQ |
| `/pricing` | Three plans with monthly/yearly toggle and a full feature comparison table |
| `/templates` | Six real creator pages and all twelve themes, rendered live (not screenshots) |
| `/explore` | Directory of every published creator, real accounts first |
| `/terms`, `/privacy` | Written legal pages |

### The product
| Route | What it does |
| --- | --- |
| `/signup`, `/login` | Email + password auth with live username availability |
| `/onboarding` | Four-step guided setup with a live phone preview |
| `/dashboard` | Block editor — drag to reorder, inline editing, live preview, per-block click counts |
| `/dashboard/appearance` | 12 presets plus full control of background, buttons, fonts, colours, avatar shape, and 14 animated surface effects |
| `/dashboard/analytics` | Views, clicks, CTR, period-over-period deltas, time series, top links, referrers, devices |
| `/dashboard/store` | Products and orders, publish/hide, revenue |
| `/dashboard/audience` | Subscriber list, search, growth sparkline, CSV export |
| `/dashboard/broadcasts` | Compose and send email campaigns to your subscriber list |
| `/dashboard/calendar` | Weekly availability and incoming bookings |
| `/dashboard/media-kit` | Editable rate card, audience stats and brand list |
| `/dashboard/billing` | Plan and subscription, plus payout onboarding for creator sales |
| `/dashboard/settings` | Change handle, password, plan, custom domain, QR code; delete account |
| `/:username` | The public page — themed, tracked, shareable |
| `/:username/media-kit` | Public media kit (Pro) |

### Fourteen block types
Link · Header · Text · Image · Video · Social icons · Email capture · Tip jar ·
Product · Divider · Gallery · FAQ · Booking · Music

Video and music blocks turn YouTube, Vimeo, Spotify and SoundCloud share links into
real embedded players; anything else degrades gracefully to a button.

---

---

## Repository layout

A [Turborepo](https://turborepo.com) workspace. The app owns routing and HTTP concerns;
everything reusable or independently testable lives in a package.

```
apps/
  web/                     Next.js application
    src/app/               routes — each with its own _components/ folder
    src/components/        shared across route areas only
    src/lib/               app glue: auth, http, rate limiting, data loaders
packages/
  core/                    pure domain — blocks, themes, pricing, scheduling, domains
  db/                      Prisma schema, migrations, generated client
  ui/                      design-system primitives (button, field, modal, toast, uploads)
  effects/                 animated surface effects — registry, stylesheet, pointer hook
  payments/                Stripe
  email/                   Resend
  storage/                 Vercel Blob
  ai/                      Vercel AI Gateway
  eslint-config/           shared lint rules
  typescript-config/       shared tsconfig bases
```

**Where does a component go?** If exactly one route uses it, it belongs in that route's
`_components/` folder (the `_` prefix keeps it out of routing). If several route areas use
it, it moves to `apps/web/src/components/`. If it is presentational and carries no product
knowledge, it belongs in `@plink/ui`.

**Dependency direction** is one-way: `app → integrations → core`. `@plink/core` depends on
nothing in the workspace, which is what keeps it unit-testable without mocks. `@plink/ui`
depends on `core`, never the reverse.


## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) | Server Components for data, Server Actions for mutations |
| UI | React 19 + Tailwind CSS v4 | Design tokens live in `globals.css` via `@theme` |
| Database | Prisma 7 + Postgres (driver adapter) | Neon in development and production alike — no provider drift |
| Auth | `jose` JWT in an HTTP-only cookie + `bcryptjs` | No third-party dependency, sessions revocable in the DB |
| Validation | Zod | Every API route and Server Action validates its input |
| Charts | Recharts | Entry animation disabled — it can stall and leave a chart blank |
| Drag & drop | dnd-kit | Keyboard-accessible reordering |
| Payments | Stripe (Checkout, Subscriptions, Connect) | Product sales, tips, plan billing and creator payouts |
| Email | Resend | Verification, password reset and audience broadcasts |
| Uploads | Vercel Blob | Avatars, banners, block images and digital product files |
| AI | Vercel AI Gateway + AI SDK | The AI page builder and copy generation |
| Tests | Vitest + Playwright | Unit tests across lib modules, E2E across desktop and mobile |

---

## Running it

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # then set AUTH_SECRET to a long random value
pnpm db:migrate                                # apply the schema to your database
pnpm db:seed                                   # 90 days of demo analytics, products, orders
pnpm dev
```

Every task runs through Turborepo from the repo root — `pnpm build`, `pnpm test`,
`pnpm lint`, `pnpm typecheck`, `pnpm test:e2e`. Add `--filter @plink/web` (or any package
name) to scope a task to one workspace.

Open <http://localhost:3000>.

### Integration keys

Every third-party integration is **optional in development**. Each one checks for its key at
call time, never at import, so the app boots and builds with all of them blank — the relevant
surface simply renders a "not configured" state instead of erroring.

| Key | Unlocks | Where to get it |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | Product checkout, tips, plan billing, payouts | <https://dashboard.stripe.com/apikeys> |
| `RESEND_API_KEY` + `RESEND_FROM_EMAIL` | Email verification, password reset, broadcasts | <https://resend.com/api-keys> |
| `BLOB_READ_WRITE_TOKEN` | Image and file uploads | Vercel dashboard → Storage |
| `AI_GATEWAY_API_KEY` | AI page builder and copy generation | Vercel dashboard → AI Gateway |

Point Stripe's webhook at `/api/stripe/webhook`. Locally:
`stripe listen --forward-to localhost:3000/api/stripe/webhook`.

**Demo account** — `maya@plink.demo` / `plinkdemo123` (page at `/mayabuilds`)
(the login page has a one-click "fill it in for me" button)

### Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint (Next core-web-vitals + TypeScript) |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright — builds, starts on :3100, runs desktop + mobile |
| `pnpm test:all` | Typecheck, lint, unit, E2E |
| `pnpm db:studio` | Prisma Studio |
| `pnpm db:reset` | Drop and rebuild the database |

> **Give `test:e2e` its own database.** The suite signs up real accounts as it runs, so
> point `DATABASE_URL` at a throwaway Postgres — a Neon branch or a local container —
> not the database your app is serving from. CI uses a Postgres service container.

---

## Architecture notes

**One renderer, three contexts.** `components/profile/profile-view.tsx` renders a
creator page from plain data. The same component powers the public page, the editor's
live preview, the onboarding preview and the marketing mockups. Pass `preview` and it
renders inert elements instead of anchors — an `<a>` inside an `<a>` is invalid HTML
and breaks hydration, and only the live page is allowed to own the document's `<h1>`.

**Effects are data too, and a second axis.** A surface keeps its style and radius
and gains an effect on top, so fourteen effects multiply against five styles rather
than adding fourteen flat options. `packages/effects` declares each one in a registry
and implements it in a single static stylesheet written only against `--pl-*` custom
properties, which `buttonEffectVars()` emits from the creator's palette. The
stylesheet never learns about users and the database never learns about CSS, so
adding the twentieth effect costs exactly what the second did: one registry entry and
one CSS rule. Effects paint on pseudo-elements behind the content with
`pointer-events: none`, which is what lets a beam wrap a card containing a live form.
`prefers-reduced-motion` turns all of it off.

**Themes are data, not classes.** A theme is sixteen columns on a row
(`lib/themes.ts`). Pure functions turn that row into inline styles, so a creator can
change any colour without a rebuild and the preview updates on the same tick.

**Mutations are Server Actions.** `app/dashboard/actions.ts` holds every write. Each
one re-reads the session, validates with Zod, scopes the query to the owner
(`updateMany({ where: { id, userId } })` — never a bare id), and revalidates the
affected paths. The editor updates optimistically and rolls back on failure.

**Writes are debounced, not on a Save button.** `useDebouncedSave` batches keystrokes
and flushes on unmount and on tab hide, so nothing is lost by navigating away.

**Analytics is event-sourced.** Page views and clicks are separate rows with a
referrer and device, written from a `sendBeacon` on the client so bots and prefetches
don't inflate a creator's numbers. Ranges are clamped to the account's creation date.

**Rate limiting.** A fixed-window limiter guards signup, login, subscribe, tips and
username checks. It is in-process by design; swap the `Map` in `lib/rate-limit.ts` for
Redis when running more than one instance.

**Creator-supplied URLs are sanitised.** `safeUrl` neutralises `javascript:`, `data:`,
`vbscript:`, `file:` and `blob:` before anything reaches an `href`.

---

## Moving to production

1. **Database** — already Postgres. Point `DATABASE_URL` at your instance and run
   `pnpm db:deploy`. On Neon use the **pooled** host (the one ending in `-pooler`) with
   `sslmode=verify-full`, so serverless invocations share connections rather than
   exhausting them. Keep the direct host in `DATABASE_URL_UNPOOLED` in case a migration
   ever needs a session-mode connection.
2. **Secrets** — set a real `AUTH_SECRET` (`openssl rand -base64 48`) and
   `NEXT_PUBLIC_SITE_URL`. Without `AUTH_SECRET` the app falls back to a constant that
   is public in this repo, so anyone could forge a session cookie — never deploy on it.
3. **Payments** — `api/tip` and the store record orders directly. Replace those
   handlers with a Stripe Checkout session and move the order write into the webhook.
4. **Rate limiting** — move the limiter to a shared store.
5. **Uploads** — avatars, covers and product art take URLs today. Add blob storage and
   swap the URL fields for an upload control.

---

## Testing

```bash
pnpm test        # 43 unit tests: URL safety, themes, embeds, rate limiting, parsing
pnpm test:e2e    # 39 E2E tests on Chromium desktop + Pixel 5
```

The E2E suite covers the full signup → onboarding → publish path, every dashboard
section, the analytics chart actually painting its series, and a horizontal-overflow
assertion on every public route at both viewports.

---

## Licence

MIT. An independent study of the link-in-bio category — not affiliated with Beacons.
