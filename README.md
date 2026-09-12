# Potatoni

_Crispy outside, happy inside._ A monolith POS + owner dashboard for the Potatoni fries & chicken-bites stall.

- **Register (`/`)**: cashiers sell from the menu board (size → cut → 2 free seasonings → add-ons) and charge by QRIS or cash.
- **Orders (`/orders`)**: today's orders, with payment for any that are still pending.
- **Purchases (`/purchases`)**: record stock buys (potatoes, oil, chicken…) so the owner sees real profit.
- **Dashboard (`/dashboard`)**: owner-only overview (sales vs purchases), orders, products, seasonings & add-ons, purchases, the full activity log, and team accounts.

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

## Payments: one QRIS, no gateway

The stall's printed QRIS (`apps/web/assets/source/qris.jpg`) is decoded once into `STATIC_QRIS_PAYLOAD` (`src/lib/qris.ts`). For every order the register turns it into a **dynamic QRIS with the amount embedded** (tag 54, recomputed CRC16), so the customer only scans and confirms. If a payer app refuses the dynamic code, the cashier can switch to the printed QRIS image. There is no payment callback, so the cashier taps **Payment received** once the incoming-payment notification shows up. Every confirmation is written to the activity log with the cashier's name.

## Database connections

The pooled Prisma Postgres connection can drop mid-query ("Connection terminated unexpectedly"). `src/lib/db.ts` keeps sockets alive and **retries read queries once** on a fresh connection. Writes are never retried, so an order can't be recorded twice. Instead the API answers `503 Lost connection to the database — please try again`.

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

Order prices are always recalculated on the server from the database. The client only sends variant and modifier ids. Order items snapshot names and prices, so later menu edits never rewrite sales history.
