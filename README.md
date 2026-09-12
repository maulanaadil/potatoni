# Potatoni

_Crispy outside, happy inside._ A monolith POS + owner dashboard for the Potatoni fries & chicken-bites stall.

- **Register (`/`)**: cashiers sell from the menu board (size → cut → 2 free seasonings → add-ons) and charge by QRIS or cash.
- **Orders (`/orders`)**: today's orders, with payment for any that are still pending.
- **Purchases (`/purchases`)**: record stock buys (potatoes, oil, chicken…) so the owner sees real profit.
- **Dashboard (`/dashboard`)**: owner-only overview (sales vs purchases), orders, products, seasonings & add-ons, purchases, the full activity log, and team accounts.
- **Assistant (`/dashboard/assistant`)**: an internal AI marketer and personal assistant (Gemini). It reads the business data read-only and answers questions about sales, best sellers, upcoming bazaars and promos. It runs as its own service in [`apps/ai`](apps/ai/README.md).

Built for laptop, iPad (portrait and landscape) and iPhone.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router, route handlers, `src/proxy.ts` auth gate), React 19 |
| Styling | Tailwind CSS v4 (tokens in `src/app/globals.css`), Base UI dialogs/drawer, Sonner toasts, NumberFlow |
| Data fetching | SWR on the client (server-rendered `fallbackData`, polling on live screens) |
| Database | PostgreSQL (Prisma Postgres) via Prisma 7 + `@prisma/adapter-pg` |
| Auth | JWT (HS256, `jose`) in an httpOnly cookie, also accepted as `Authorization: Bearer` |
| Storage | S3-compatible bucket (Tigris `t3.storage.dev`), streamed through `/api/media/*` |
| Charts | Recharts, with a palette checked by the dataviz validator |
| AI assistant | `apps/ai`: Hono service, Gemini function calling, read-only SQL tools |

## Payments: one QRIS, no gateway

The stall's printed QRIS (`apps/web/assets/source/qris.jpg`) is decoded once into `STATIC_QRIS_PAYLOAD` (`src/lib/qris.ts`). For every order the register turns it into a **dynamic QRIS with the amount embedded** (tag 54, recomputed CRC16), so the customer only scans and confirms. If a payer app refuses the dynamic code, the cashier can switch to the printed QRIS image. There is no payment callback, so the cashier taps **Payment received** once the incoming-payment notification shows up. Every confirmation is written to the activity log with the cashier's name.

## Database connections

The pooled Prisma Postgres connection can drop mid-query ("Connection terminated unexpectedly"). `src/lib/db.ts` keeps sockets alive and **retries read queries once** on a fresh connection. Writes are never retried, so an order can't be recorded twice. Instead the API answers `503 Lost connection to the database — please try again`.

## Head, icons & SEO

- **Icons:** `assets/source/icon.svg` (the smiling fries-box badge) is the single source. `pnpm --filter web assets:brand` builds `favicon.ico` (16/32/48), `icon.svg`, `apple-icon.png`, the manifest icons in `public/icons/` (192, 512, maskable 512), and the 1200×630 share image `opengraph-image.jpg` / `twitter-image.jpg`.
- **Install as an app:** `src/app/manifest.ts` lets iPad and iPhone add the register to the home screen and run it full-screen.
- **Not indexed:** this is a private POS behind a login, so `robots.ts` disallows everything and pages send `noindex`. Link previews (WhatsApp, Telegram) still work. Flip `robots` in `src/app/layout.tsx` and `robots.ts` if a public page is added.
- **`APP_URL` must be set when building.** Share-image URLs are baked in at build time, so set `APP_URL` (e.g. `https://potatoni.id`) in the build environment, not just at runtime.
- The auth gate (`src/proxy.ts`) lets the manifest, robots, icons and share images load without a session.

## Team invites

Owners invite people from **Dashboard → Team → Invite person**. The invitee gets an email link, valid for 7 days, where they choose a name and password. Opening the link is what verifies the email address. Only the SHA-256 of each link token is stored, so a new invite or a resend invalidates the older links. There is no direct account creation anymore.

## Vouchers & customers

- **Campaigns** (**Dashboard → Vouchers**): percent off with an optional cap, or rupiah off; a minimum spend; a claim window; a quota; and how long each voucher stays valid. Each campaign has a public link `/v/<slug>`, a downloadable QR code, and a printable A4 poster.
- **Claiming** (customers, on their phone): name, WhatsApp number (stored as `+62…`), email and an optional promo consent. The customer then enters a 6-digit code sent by email: it expires in 10 minutes, allows 5 attempts, has a 30-second resend cooldown and is capped at 5 sends. After that they get a voucher code (`PTN-XXXXXX`) with a QR, on screen and by email. Each campaign allows one voucher per email and one per phone.
- **Redeeming** (register): the cashier types the code in the cart. The discount is computed on the server when the order is created. The voucher is marked used when the order is paid, and freed again if the order is cancelled or deleted.
- **Customers** (**Dashboard → Customers**): search and WhatsApp links, plus CSV export. The default export only includes people who agreed to promos, which is what UU PDP expects for marketing; "Export everyone" includes all.

## Email (SMTP)

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM` in `apps/web/.env` (see `.env.example`). Any SMTP provider works, for example a Gmail app password, Brevo or Resend.

- **No `SMTP_HOST` in development:** emails are printed to the terminal, and the invite link or voucher code is shown on screen so the flows can still be tested.
- **No `SMTP_HOST` in production:** the API answers `503` instead of pretending the email was sent.

## Getting started

```bash
nvm use                           # Node 25 (.nvmrc)
pnpm install                      # also runs `prisma generate`
cp apps/web/.env.example apps/web/.env   # fill in DATABASE_URL, JWT_SECRET, S3_*, ADMIN_*
pnpm --filter web db:deploy       # apply migrations
pnpm --filter web db:seed         # menu from the board + owner account (ADMIN_EMAIL / ADMIN_PASSWORD)
pnpm --filter web assets:upload   # crop menu-board photos + QRIS and upload them to the bucket
pnpm dev                          # http://localhost:3000
```

In Conductor, `.conductor/settings.toml` handles the setup, and the **dev** run script starts the app on `$CONDUCTOR_PORT`. `.worktreeinclude` copies `apps/web/.env` from the main checkout into new workspaces.

### CI (`.github/workflows/ci.yml`)

CI runs on every pull request and every push to `main`. It has four parallel jobs, using Node from `.nvmrc` and pnpm from `packageManager`:

| Job | Checks |
| --- | --- |
| Dependencies | no `yarn.lock` / `package-lock.json` / `bun.lock`; `pnpm install --frozen-lockfile`; `pnpm audit --prod --audit-level high` |
| Lint | `pnpm lint` (ESLint, zero warnings) |
| Typecheck | `pnpm check-types` |
| Build | `pnpm build` (Prisma client + Next.js), using placeholder `DATABASE_URL`/`APP_URL`, so no secrets are needed |

- Actions are pinned to commit SHAs.
- The workflow token is read-only, and checkout doesn't keep git credentials.
- A new push cancels the run it replaces.
- Turbo runs in strict env mode, so `turbo.json` declares the build's variables: `APP_URL` is part of the cache key, and `DATABASE_URL` is passed through.
- Security overrides for transitive dependencies live in `pnpm-workspace.yaml`. Remove each one once its parent package ships the fix.

### Scripts (`apps/web`)

| Script | What it does |
| --- | --- |
| `db:migrate` | `prisma migrate dev` (create migrations while developing) |
| `db:deploy` | `prisma migrate deploy` |
| `db:seed` | Idempotent seed of products, seasonings/add-ons and the owner account |
| `db:studio` | Prisma Studio |
| `assets:upload` | Crop + upload brand/menu images (`--dry-run` writes previews to `.context/asset-preview`) |

## API

All endpoints return JSON. Errors are `{ "error": "<English message>" }`.

| Method | Path | Who |
| --- | --- | --- |
| POST | `/api/auth/login` → `{ token, user }` + cookie | public |
| POST | `/api/auth/logout` | any |
| GET | `/api/auth/me` | signed in |
| GET | `/api/menu` | signed in |
| GET / POST | `/api/orders` (today) | signed in |
| GET | `/api/orders/:id` | signed in |
| POST | `/api/orders/:id/pay`, `/api/orders/:id/cancel` | signed in (paid orders: admin only) |
| GET / POST | `/api/purchases` | signed in (date range: admin) |
| PATCH / DELETE | `/api/purchases/:id` | admin |
| CRUD | `/api/admin/products[/:id]`, `/api/admin/modifiers[/:id]`, `/api/admin/users[/:id]` | admin |
| GET / PATCH / DELETE | `/api/admin/orders[/:id]` | admin |
| GET | `/api/admin/stats`, `/api/admin/activity` | admin |
| POST | `/api/admin/uploads` (multipart image → S3 key) | admin |
| GET | `/api/media/:key*` | public (product images, QRIS) |
| GET / POST | `/api/admin/invites`; DELETE `/api/admin/invites/:id`; POST `/api/admin/invites/:id/resend` | admin |
| POST | `/api/invites/:token/accept` → creates the account and signs in | public (link from the email) |
| CRUD | `/api/admin/vouchers[/:id]` (campaigns; delete only when nothing was claimed) | admin |
| GET | `/api/admin/customers?q=&consent=1`, `/api/admin/customers/export[?all=1]` (CSV) | admin |
| POST | `/api/vouchers/:slug/claim`, `/api/vouchers/claims/:id/verify`, `/api/vouchers/claims/:id/resend` | public, rate-limited |
| GET | `/api/vouchers/check?code=&subtotal=` (discount preview) | signed in |
| GET / POST | `/api/locations` (register), `/api/admin/locations[/:id]` | signed in / admin |

Order prices are always recalculated on the server from the database. The client only sends variant and modifier ids. Order items snapshot names and prices, so later menu edits never rewrite sales history.
