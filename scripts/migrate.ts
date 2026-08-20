/**
 * Applies drizzle migrations against whichever driver DATABASE_URL selects.
 *
 *   npm run db:migrate
 *
 * drizzle-kit's own migrate command only speaks to a real Postgres server, so
 * this runs the migrator in-process instead and works for PGlite too.
 */
import { db, usingPglite } from "../lib/db/index.ts";

const folder = "./drizzle";

if (usingPglite) {
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(db as any, { migrationsFolder: folder });
  console.log("migrated (pglite)");
} else {
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(db as any, { migrationsFolder: folder });
  console.log("migrated (postgres)");
}

process.exit(0);
