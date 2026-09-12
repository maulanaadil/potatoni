import pg from "pg";
import { env } from "./env.ts";

// Plain numbers for bigint/numeric sums and counts, YYYY-MM-DD strings for @db.Date columns.
pg.types.setTypeParser(pg.types.builtins.INT8, Number);
pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number);
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 5,
  keepAlive: true,
  connectionTimeoutMillis: 10_000,
});
pool.on("error", (err) => console.warn(`[db] idle connection dropped: ${err.message}`));

export type Query = <Row = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<Row[]>;

// The pooled Prisma Postgres connection can drop mid-query (same as apps/web/src/lib/db.ts).
const isDroppedConnection = (err: unknown) =>
  err instanceof Error &&
  /Connection terminated|ECONNRESET|Connection closed|terminating connection|Client has encountered a connection error/i.test(
    err.message,
  );

async function attempt<T>(fn: (query: Query) => Promise<T>) {
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '10s'");
    // A client runs one query at a time, but tools fire several with Promise.all.
    let queue: Promise<unknown> = Promise.resolve();
    const query: Query = (sql, params) => {
      const run = queue.then(() => client.query(sql, params));
      queue = run.catch(() => {});
      return run.then((r) => r.rows);
    };
    const result = await fn(query);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    broken = isDroppedConnection(err);
    if (!broken) await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release(broken);
  }
}

// READ ONLY transaction: Postgres rejects any write, so retrying once on a dropped connection is safe.
export async function readOnly<T>(fn: (query: Query) => Promise<T>): Promise<T> {
  try {
    return await attempt(fn);
  } catch (err) {
    if (!isDroppedConnection(err)) throw err;
    console.warn("[db] retrying after dropped connection");
    return attempt(fn);
  }
}
