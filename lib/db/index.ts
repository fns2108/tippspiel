import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * One driver, one database: postgres.js against Neon.
 *
 * There is deliberately no local/embedded fallback. Every environment — the
 * deployment, a script on a laptop, a migration — connects to the same real
 * Postgres, so the SQL that runs in development is the SQL that runs in
 * production. Anything you run against this touches live data.
 */

type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __db?: Db };

function create(): Db {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. This app has no local database — point it at " +
        "your Postgres connection string (Neon's pooled URL in production).",
    );
  }

  // Serverless invocations are short-lived and Neon's pooler already pools, so
  // keep one connection per instance. `prepare: false` is required because
  // pgbouncer in transaction mode cannot carry prepared statements across
  // checkouts.
  const client = postgres(url, { max: 1, prepare: false, idle_timeout: 20 });
  return drizzle(client, { schema });
}

/**
 * Connected on first query, not on import.
 *
 * `next build` imports this module while collecting page data, long before any
 * runtime environment exists — an eager connection would either fail the build
 * or open a pointless one on every builder.
 */
function getDb(): Db {
  if (!globalForDb.__db) globalForDb.__db = create();
  return globalForDb.__db;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
