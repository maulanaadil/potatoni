# Potatoni assistant (`apps/ai`)

An internal AI agent for the owner: a senior marketer and personal assistant that knows the business from the database and suggests how to sell more. It's behind **Dashboard → Assistant**.

- **Model:** Claude (`claude-opus-5` by default) through the official Anthropic TypeScript SDK, with tool use.
- **Server:** [Hono](https://hono.dev) on Node 25. Node runs the TypeScript sources directly, so there's no build step.
- **Data:** read-only SQL on the same Postgres as `apps/web`.

## How it answers

1. The dashboard sends the visible conversation to `POST /api/admin/assistant` (web). That route checks the owner's session and forwards the request, with the same JWT, to this service's `POST /chat`.
2. The service verifies the JWT itself (`JWT_SECRET`, owners only), then runs the agent loop (`src/agent.ts`): Claude picks tools, the service runs them in parallel, and the results go back to Claude. This repeats for up to 8 rounds; the last round has to answer in text.
3. The system prompt (`src/prompt.ts`) sets the persona, the business context, today's date (WIB) and the reply style.

| Tool | What the model gets |
| --- | --- |
| `get_business_overview` | Menu and prices, all-time sales/purchases, customer-list size, vouchers, locations, and a note when there's no sales data yet |
| `get_sales_report` | Revenue, orders, average ticket, items per order, QRIS vs cash, cancellations, broken down by day, week, weekday or hour |
| `get_product_performance` | Units and revenue per product and size, seasoning/add-on/upgrade uptake, paid-extra attach rate |
| `get_locations` | Every spot/event with status (current, upcoming, ended), days until start, and performance |
| `get_costs` | Stock purchases by item and supplier compared with sales, and net |
| `get_voucher_performance` | Per campaign: issued, redeemed, redemption rate, discount given, revenue |
| `get_customer_insights` | Customer-list counts, promo consent, repeat users, sign-ups per week (no personal data) |
| `web_search` | Anthropic's hosted web search (located in Bandung) for bazaars and events. Cited pages are appended to the answer as "Sources" |

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
| `ANTHROPIC_MODEL` | Defaults to `claude-opus-5` |
| `DATABASE_URL`, `JWT_SECRET` | Same values as `apps/web`, read from `../web/.env` locally |
| `PORT` | Defaults to `4000` |

The web app finds the service through `AI_SERVICE_URL` in `apps/web/.env` (default `http://localhost:4000`).

## Endpoints

| Method | Path | |
| --- | --- | --- |
| GET | `/health` | `{ ok, model }` |
| POST | `/chat` | `Authorization: Bearer <session JWT>`, body `{ messages: [{ role: "user" \| "assistant", content }] }` → `{ reply, tools }` |

Errors are `{ "error": "<English message>" }`. Rate limits return `429` and an overloaded model returns `503`, each after the SDK's own retries.
