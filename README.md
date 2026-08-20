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
| `/dashboard/appearance` | 12 presets plus full control of background, buttons, fonts, colours, avatar shape |
| `/dashboard/analytics` | Views, clicks, CTR, period-over-period deltas, time series, top links, referrers, devices |
| `/dashboard/store` | Products and orders, publish/hide, revenue |
| `/dashboard/audience` | Subscriber list, search, growth sparkline, CSV export |
| `/dashboard/media-kit` | Editable rate card, audience stats and brand list |
| `/dashboard/settings` | Change handle, password, plan; delete account |
| `/:username` | The public page — themed, tracked, shareable |
| `/:username/media-kit` | Public media kit (Pro) |

### Fourteen block types
Link · Header · Text · Image · Video · Social icons · Email capture · Tip jar ·
Product · Divider · Gallery · FAQ · Booking · Music

Video and music blocks turn YouTube, Vimeo, Spotify and SoundCloud share links into
real embedded players; anything else degrades gracefully to a button.

---

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) | Server Components for data, Server Actions for mutations |
| UI | React 19 + Tailwind CSS v4 | Design tokens live in `globals.css` via `@theme` |
| Database | Prisma 7 + SQLite (driver adapter) | Zero-setup locally, one line to move to Postgres |
| Auth | `jose` JWT in an HTTP-only cookie + `bcryptjs` | No third-party dependency, sessions revocable in the DB |
| Validation | Zod | Every API route and Server Action validates its input |
| Charts | Recharts | Entry animation disabled — it can stall and leave a chart blank |
| Drag & drop | dnd-kit | Keyboard-accessible reordering |
| Tests | Vitest + Playwright | 43 unit tests, 39 E2E tests across desktop and mobile |

---

## Running it

```bash
pnpm install
cp .env.example .env          # then set AUTH_SECRET to something long and random
pnpm db:migrate               # create the SQLite database
pnpm db:seed                  # 90 days of demo analytics, products, orders, subscribers
pnpm dev
```

Open <http://localhost:3000>.

**Demo account** — `maya@plink.demo` / `plinkdemo123`
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

---

## Architecture notes

**One renderer, three contexts.** `components/profile/profile-view.tsx` renders a
creator page from plain data. The same component powers the public page, the editor's
live preview, the onboarding preview and the marketing mockups. Pass `preview` and it
renders inert elements instead of anchors — an `<a>` inside an `<a>` is invalid HTML
and breaks hydration, and only the live page is allowed to own the document's `<h1>`.

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

1. **Database** — change `provider` to `postgresql` in `prisma/schema.prisma`, swap
   `@prisma/adapter-better-sqlite3` for the Postgres adapter in `lib/prisma.ts`, and
   point `DATABASE_URL` at your instance. No application code changes.
2. **Secrets** — set a real `AUTH_SECRET` (`openssl rand -base64 48`) and
   `NEXT_PUBLIC_SITE_URL`.
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
