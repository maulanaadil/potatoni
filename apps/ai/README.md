# Potatoni assistant (`apps/ai`)

An internal AI agent for the owner: a senior marketer and personal assistant that knows the business from the database and suggests how to sell more. It's behind **Dashboard → Assistant**.

- **Model:** Claude (`claude-haiku-4-5` by default, fast and cheap; set `ANTHROPIC_MODEL` to `claude-sonnet-5` or `claude-opus-5` for deeper answers) through the official Anthropic TypeScript SDK, with tool use.
- **Server:** [Hono](https://hono.dev) on Node 25. Node runs the TypeScript sources directly, so there's no build step.
- **Data:** read-only SQL on the same Postgres as `apps/web`.

## How it answers

1. The dashboard sends a question (and up to 3 photos) to `POST /api/admin/assistant` (web). The web app keeps each owner's chats in Postgres (`AssistantChat`, `AssistantMessage`). It loads the chat's saved history, adds the photos as base64, and forwards everything with the owner's JWT to this service's `POST /chat`. Both turns are saved once the answer arrives. This service never writes.
2. The service verifies the JWT itself (`JWT_SECRET`, owners only), then runs the agent loop (`src/agent.ts`): Claude picks tools, the service runs them in parallel, and the results go back to Claude. This repeats for up to 8 rounds; the last round has to answer in text.
3. The system prompt has two parts:
   - The team's **instructions** (persona, business context, style). They're edited in **Dashboard → Assistant → Instructions**, stored in `AssistantSettings`, and sent with every question. `{{owner_name}}` and `{{today}}` are filled in here.
   - The fixed **operating rules** in `src/prompt.ts` (read-only access, confirm-before-save forms, privacy, chat formatting). The dashboard shows these through `GET /rules`.

| Tool | What the model gets |
| --- | --- |
| `get_business_overview` | Menu and prices, all-time sales/purchases, customer-list size, vouchers, locations, and a note when there's no sales data yet |
| `get_sales_report` | Revenue, orders, average ticket, items per order, QRIS vs cash, cancellations, broken down by day, week, weekday or hour |
| `get_product_performance` | Units and revenue per product and size, seasoning/add-on/upgrade uptake, paid-extra attach rate |
| `get_locations` | Every spot/event with status (current, upcoming, ended), days until start, and performance |
| `get_costs` | Stock purchases by item and supplier compared with sales, and net |
| `get_voucher_performance` | Per campaign: issued, redeemed, redemption rate, discount given, revenue |
| `get_customer_insights` | Customer-list counts, promo consent, repeat users, sign-ups per week (no personal data) |
| `web_search` | Anthropic's hosted web search (located in Bandung) for bazaars and events. Cited pages are appended to the answer as "Sources". Haiku uses the basic `web_search_20250305`; Opus/Sonnet 4.6+ get `web_search_20260209`, which filters results with code |

Proposal tools (`src/proposals.ts`) fill in a form instead of saving anything. The dashboard shows it under the answer, fully editable, and it's saved only when the owner presses **Record** or **Add**. The save goes through the normal `/api/purchases` or `/api/admin/locations`, with the same validation and activity log.

| Tool | What it does |
| --- | --- |
| `propose_purchases` | Stock bought, read from a receipt, marketplace order or message: one line per item, with discounts subtracted and pack sizes converted (3 × 2L = 6 ltr) |
| `propose_location` | A bazaar or event, read from a poster or message: name, address, dates, notes (fee, contact) |
| `suggest_replies` | 2–3 follow-up questions shown as tappable chips |

When a proposal is the last thing Claude does after writing its answer, the loop ends there, with no extra round trip. Earlier proposals go back into the history as `[Proposed …]` notes, so "use the price after the discount" corrects the real form. In the dashboard, only the newest form of each kind can be saved.

Claude API features in use:
- **Prompt caching.** The top-level `cache_control` caches tools, system and history, so each tool round re-reads them cheaply.
- **Refusal fallback.** On Opus 5, `fallbacks: "default"` means a declined request is re-run on Anthropic's recommended model.
- **`pause_turn` resumes** for long web searches.
- **SDK retries** for 429 and 5xx/529 errors.

## Safety

- The model never writes SQL. Every tool is a fixed query, and each runs inside `BEGIN READ ONLY` with a 10-second statement timeout, so Postgres rejects any write.
- Customer names, emails and phone numbers are never selected, so no personal data is sent to Claude.
- Only owners (JWT role `ADMIN`) can call `/chat`.

## Running it

```bash
cp apps/ai/.env.example apps/ai/.env   # ANTHROPIC_API_KEY (DATABASE_URL + JWT_SECRET come from apps/web/.env)
pnpm --filter ai dev                    # http://localhost:4000, restarts on changes
```

`pnpm dev` at the root starts it together with the web app. In Conductor, use the **ai** run script. It listens on `CONDUCTOR_PORT + 2`, which is where the **dev** script points `AI_SERVICE_URL`.

| Variable | |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude API key (required) |
| `ANTHROPIC_MODEL` | Defaults to `claude-haiku-4-5` |
| `DATABASE_URL`, `JWT_SECRET` | Same values as `apps/web`, read from `../web/.env` locally |
| `PORT` | Defaults to `4000` |

The web app finds the service through `AI_SERVICE_URL` in `apps/web/.env` (default `http://localhost:4000`).

## Production (Vercel)

- **Entry points:** `src/app.ts` exports the Hono app, and Vercel serves it as a function (Hono preset, Fluid compute). `src/dev.ts` is only the local runner.
- **Project:** `potatoni-ai` (https://potatoni-ai.vercel.app) in the same Vercel scope as `potatoni`.
  - Settings: root directory `apps/ai`, region `sin1`, install `pnpm install --frozen-lockfile --filter ai...`.
  - Env: `DATABASE_URL`, `JWT_SECRET`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, and `ENABLE_EXPERIMENTAL_COREPACK=1` for pnpm 11.
- **Deploys:** `.github/workflows/deploy.yml` deploys it together with the web app after CI passes on `main`. It uses the `VERCEL_AI_PROJECT_ID` variable on the `production` environment.
- **Web app:** the `potatoni` project reaches the service through `AI_SERVICE_URL=https://potatoni-ai.vercel.app`.
- **Request size:** Vercel caps request bodies at 4.5 MB, so the web app rejects photo batches over about 3.8 MB (base64). The dashboard already shrinks photos above 700 KB.

## Endpoints

| Method | Path | |
| --- | --- | --- |
| GET | `/health` | `{ ok, model }` |
| POST | `/chat` | `Authorization: Bearer <session JWT>`, body `{ messages: [{ role: "user" \| "assistant", content, images?: [{ media_type, data }] }] }` → `{ reply, tools, actions, replies }` |

Errors are `{ "error": "<English message>" }`. Rate limits return `429` and an overloaded model returns `503`, each after the SDK's own retries.
