import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations take a session-level advisory lock, which a pooled connection can leave stuck.
    url: process.env.DIRECT_DATABASE_URL || env("DATABASE_URL"),
  },
});
