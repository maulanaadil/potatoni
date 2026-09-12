import { PrismaPg } from "@prisma/adapter-pg";
import type { PoolConfig } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

// The remote pooler (or the network in between) can drop a connection while a query is
// in flight; pg then fails that query with "Connection terminated unexpectedly".
// Keep sockets alive and give reads one retry on a fresh connection.
const READ_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

export const isDroppedConnection = (err: unknown) =>
  err instanceof Error &&
  /Connection terminated|ECONNRESET|Connection closed|terminating connection|Client has encountered a connection error/i.test(
    err.message,
  );

/** Exported so scripts/tests can point the same client at another pool config. */
export function createClient(pool: PoolConfig = { connectionString: process.env.DATABASE_URL! }) {
  const adapter = new PrismaPg(
    { max: 10, connectionTimeoutMillis: 10_000, keepAlive: true, ...pool },
    { onPoolError: (err) => console.warn(`[db] idle connection dropped: ${err.message}`) },
  );

  return new PrismaClient({ adapter }).$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          try {
            return await query(args);
          } catch (err) {
            // Writes are never retried: a dropped socket mid-write could double-charge an order.
            if (!READ_OPERATIONS.has(operation) || !isDroppedConnection(err)) throw err;
            console.warn(`[db] retrying ${operation} after dropped connection`);
            return query(args);
          }
        },
      },
    },
  });
}

type Db = ReturnType<typeof createClient>;
const globalForPrisma = globalThis as unknown as { prisma?: Db };

// Reuse one client across hot reloads in dev.
export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
