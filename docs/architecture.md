# Architecture and design decisions

Potatoni is the point of sale, kitchen screen, owner dashboard and AI analyst for a real food stall. It is a TypeScript monorepo (Next.js 16, PostgreSQL, a separate Hono service for the AI), designed so that an LLM can work on live business data without being able to change or leak it.

The diagrams referenced here are in the [README](../README.md#how-it-works).

## 1. System

Three roles (cashier, kitchen, owner) use one installable PWA. `apps/web` holds the pages, API routes and Prisma schema. Postgres is the only source of truth, images live in an S3-compatible bucket served through the app, push goes through Firebase Cloud Messaging and email through SMTP.

- **One app, role-scoped, not three apps.** The role is a JWT claim, and the same check runs for pages (`src/proxy.ts`) and API routes (`requireApiSession`). Limiting the kitchen role to `/kitchen` happens in one place, not in every screen.
- **The server owns prices.** The client sends only variant and modifier ids, and the server prices the order again from the database. Each order line stores its name and price, so editing the menu never changes past sales.
- **QRIS payments without a gateway.** The stall's printed QRIS is decoded once. For every order, the amount is embedded (tag 54) and the CRC16 checksum recomputed, so the customer only scans and confirms. The cost is that there's no payment callback: the cashier confirms receipt by hand, and the activity log records who did it.
- **Side effects stay off the payment path.** Push notifications are sent with Next's `after()`, so a slow Firebase call never holds up the register.
- **Retries are asymmetric.** The pooled Postgres connection can drop in the middle of a query. Reads retry once on a fresh connection. Writes never retry and the API answers `503` instead, so an order can't be recorded twice.

## 2. AI assistant

### Tool-based retrieval, not vector RAG

The data is structured and numeric. A question like "revenue last weekend, broken down by hour" needs exact totals, not similar-looking text, so embeddings would be the wrong tool. Instead the model gets a small set of typed tools (validated with Zod), and each one runs a fixed, parameterised SQL query. The model chooses the tool and its arguments (date range, location, grouping) but never writes SQL.

### Request flow

1. **Context.** `apps/web` loads the chat history and the owner's editable instructions from Postgres, and reads any photos from S3 as base64. `apps/ai` is stateless: it gets the whole conversation on every request and never writes anything.
2. **Trust between services.** The web app forwards the owner's JWT, and `apps/ai` verifies it again itself (owners only). It doesn't trust a request just because it came from the web app.
3. **The agent loop.** Claude requests tools, the service runs them in parallel, and the results go back to Claude. The loop stops after 8 rounds, and the last round sets `tool_choice: none` so the model has to answer in text. That caps cost and prevents runaway loops. Prompt caching covers the tools, system prompt and history, so each extra round costs little.
4. **Writes need a human.** `propose_purchases` and `propose_location` save nothing. They fill in a form that the owner edits and confirms, and the save goes through the normal web API with its usual validation and activity log.

### Safety is enforced by the database, not the prompt

| Layer | How it's enforced |
| --- | --- |
| No writes | Each tool runs in `BEGIN READ ONLY`, so Postgres itself rejects a write. That also makes retrying a dropped connection safe. |
| No runaway queries | `SET LOCAL statement_timeout = '10s'` |
| No personal data | Queries never select names, emails or phone numbers; customer data is only counted. |
| Untrusted input | Receipts and event posters are untrusted images that could hide instructions (prompt injection). Even then, the worst the model can do is run a read-only query or propose a form the owner has to confirm. |

### Trade-offs

- **Fixed tools vs. text-to-SQL.** Each new kind of question needs a new tool: flexibility traded for safety. Text-to-SQL can join the wrong tables, read personal data, and makes prompt injection far more dangerous.
- **Haiku as the default model.** It's fast and cheap for daily use, and `ANTHROPIC_MODEL` switches to Sonnet or Opus for deeper analysis.
- **One connection per tool call.** Queries inside one tool run one after another on a single connection, because a `pg` client runs one query at a time. Separate tool calls run in parallel on separate connections from the pool.

### Possible next steps

- Evals for which tool the model picks for a given question.
- Tracing for each tool call.
- Streaming the answer as it's generated.
- A semantic layer, if the number of tools keeps growing.
