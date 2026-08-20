import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Two drivers, one interface.
 *
 * - `postgres://…`  → postgres.js. What production runs against Neon.
 * - `pglite://<dir>` or unset → PGlite, real Postgres compiled to WASM, stored
 *   on disk under `.pglite/`. This is what makes `npm run dev` work on a fresh
 *   clone with no database to sign up for and nothing to install.
 *
 * Both are genuine Postgres and both expose drizzle's Pg query builder, so the
 * SQL in lib/queries.ts is identical either way. The exported type is the
 * postgres-js one because that is what production runs; PGlite satisfies the
 * same surface.
 */

const rawUrl = process.env.DATABASE_URL?.trim() ?? "";
const usePglite = rawUrl === "" || rawUrl.startsWith("pglite://");

/** A lock left behind by a killed process is stale and free to take over. */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means the process exists but belongs to someone else.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

function readHolder(lockPath: string): number | null {
  try {
    const pid = Number(readFileSync(lockPath, "utf8").trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null; // no lock file yet
  }
}

/**
 * PGlite is an in-process Postgres: exactly one process may hold a data
 * directory at a time. Two openers corrupt it, and the failure surfaces as an
 * unreadable WASM abort several operations later, so record the holder
 * explicitly and fail with something a person can act on.
 *
 * The dev server records the directory too rather than opting out of the lock.
 * It must not *refuse* — Next spawns render workers that share this module
 * legitimately, and a worker aborting its own server would be worse than the
 * problem — but without its entry a CLI script has no way to see the directory
 * is already open, which is the collision that actually corrupts the data.
 */
function claimPgliteDir(dir: string): void {
  const inNextServer = Boolean(process.env.NEXT_RUNTIME);
  const lockPath = join(dir, "pickem.lock");
  const holder = readHolder(lockPath);

  if (holder !== null && holder !== process.pid && isAlive(holder)) {
    const conflict =
      `The local database in ${dir}/ is already open in process ${holder} — ` +
      "PGlite allows only one at a time.";

    if (!inNextServer) {
      throw new Error(
        `${conflict}\n` +
          "Stop `npm run dev` before running scripts, or point DATABASE_URL at a " +
          "real Postgres so both can connect at once.",
      );
    }

    // A second dev server on one directory corrupts it just as surely, but from
    // in here it is indistinguishable from a render worker. Say so and continue.
    console.warn(`\u26a0 ${conflict}`);
  }

  mkdirSync(dir, { recursive: true });
  writeFileSync(lockPath, String(process.pid));

  const release = () => {
    try {
      if (readFileSync(lockPath, "utf8").trim() === String(process.pid)) rmSync(lockPath);
    } catch {
      /* already gone */
    }
  };
  process.once("exit", release);
  process.once("SIGINT", () => {
    release();
    process.exit(130);
  });
  process.once("SIGTERM", () => {
    release();
    process.exit(143);
  });
}

type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __db?: Db };

function create(): Db {
  if (usePglite) {
    if (process.env.NODE_ENV === "production" && !process.env.ALLOW_PGLITE) {
      throw new Error(
        "DATABASE_URL is not set. Production needs a real Postgres connection string.",
      );
    }
    const dir = rawUrl.startsWith("pglite://") ? rawUrl.slice("pglite://".length) : ".pglite";
    claimPgliteDir(dir);
    return drizzlePglite(dir, { schema }) as unknown as Db;
  }

  // Serverless invocations are short-lived and Neon's pooler already pools, so
  // keep one connection per instance. `prepare: false` is required because
  // pgbouncer in transaction mode cannot carry prepared statements across
  // checkouts.
  const client = postgres(rawUrl, { max: 1, prepare: false, idle_timeout: 20 });
  return drizzlePg(client, { schema });
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

export const usingPglite = usePglite;
export { schema };
