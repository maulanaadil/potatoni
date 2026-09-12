import { serve } from "@hono/node-server";
import app from "./app.ts";
import { pool } from "./db.ts";
import { env } from "./env.ts";

// Local runner only; on Vercel the default export of app.ts is served as a function.
const server = serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`[ai] Potatoni assistant on http://localhost:${info.port} (model: ${env.anthropicModel})`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => server.close(() => void pool.end()));
}
