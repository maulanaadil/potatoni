import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { logger } from "hono/logger";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { chat } from "./agent.ts";
import { requireAdmin } from "./auth.ts";
import { pool } from "./db.ts";
import { env } from "./env.ts";
import { HttpError, toHttpError } from "./http.ts";

const chatInput = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(8000),
        // Photos/screenshots (receipts, posters), base64 — the web app sends them for the new question only.
        images: z
          .array(
            z.object({
              media_type: z.enum(["image/png", "image/jpeg", "image/webp"]),
              data: z.string().min(1).max(7_000_000),
            }),
          )
          .max(3)
          .optional(),
      }),
    )
    .min(1, "Ask something first")
    .max(40, "This chat is too long — start a new one")
    .refine((m) => m.at(-1)?.role === "user", "The last message must be a question"),
});

type AppEnv = { Variables: { user: Awaited<ReturnType<typeof requireAdmin>> } };

const app = new Hono<AppEnv>();

app.use(logger());

app.get("/health", (c) => c.json({ ok: true, model: env.anthropicModel }));

app.use("/chat", async (c, next) => {
  c.set("user", await requireAdmin(c.req.header("authorization")));
  await next();
});

app.post(
  "/chat",
  // Room for up to three base64 images (≤5 MB each) plus the text history.
  bodyLimit({ maxSize: 24 * 1024 * 1024, onError: (c) => c.json({ error: "Request is too large" }, 413) }),
  async (c) => {
    const body = await c.req.json().catch(() => {
      throw new HttpError(400, "Request body must be JSON");
    });
    const input = chatInput.safeParse(body);
    if (!input.success) throw new HttpError(400, input.error.issues[0]?.message ?? "Invalid data");

    const user = c.get("user");
    const result = await chat(input.data.messages, user);
    console.log(`[chat] ${user.email} · tools: ${result.tools.join(", ") || "none"}`);
    return c.json(result);
  },
);

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  const { status, message } = toHttpError(err);
  if (status >= 500) console.error(err);
  return c.json({ error: message }, status as ContentfulStatusCode);
});

const server = serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`[ai] Potatoni assistant on http://localhost:${info.port} (model: ${env.anthropicModel})`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close();
    void pool.end();
  });
}
