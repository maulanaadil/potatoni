import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";
import { logger } from "hono/logger";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { chat } from "./agent.ts";
import { requireAdmin } from "./auth.ts";
import { pool } from "./db.ts";
import { env } from "./env.ts";
import { HttpError, toHttpError } from "./http.ts";
import { PROMPT_VARIABLES, RULES } from "./prompt.ts";

const imageInput = z.object({
  media_type: z.enum(["image/png", "image/jpeg", "image/webp"]),
  data: z.string().min(1).max(7_000_000),
});

const chatInput = z.object({
  instructions: z.string().trim().max(20_000).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(8000),
        images: z.array(imageInput).max(3).optional(),
      }),
    )
    .min(1, "Ask something first")
    .max(40, "This chat is too long — start a new one")
    .refine((m) => m.at(-1)?.role === "user", "The last message must be a question"),
});

type AppEnv = { Variables: { user: Awaited<ReturnType<typeof requireAdmin>> } };

const admin = createMiddleware<AppEnv>(async (c, next) => {
  c.set("user", await requireAdmin(c.req.header("authorization")));
  await next();
});

const app = new Hono<AppEnv>();

app.use(logger());

app.get("/health", (c) => c.json({ ok: true, model: env.anthropicModel }));

app.get("/rules", admin, (c) => c.json({ rules: RULES, variables: PROMPT_VARIABLES }));

app.post(
  "/chat",
  admin,
  bodyLimit({ maxSize: 24 * 1024 * 1024, onError: (c) => c.json({ error: "Request is too large" }, 413) }),
  async (c) => {
    const body = await c.req.json().catch(() => {
      throw new HttpError(400, "Request body must be JSON");
    });
    const input = chatInput.safeParse(body);
    if (!input.success) throw new HttpError(400, input.error.issues[0]?.message ?? "Invalid data");

    const user = c.get("user");
    const result = await chat({ ...input.data, user });
    const instructions = input.data.instructions ? `${input.data.instructions.length} chars` : "fallback";
    console.log(`[chat] ${user.email} · instructions: ${instructions} · tools: ${result.tools.join(", ") || "none"}`);
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
  process.once(signal, () => server.close(() => void pool.end()));
}
