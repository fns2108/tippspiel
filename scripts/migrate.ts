/**
 * Applies drizzle migrations against DATABASE_URL.
 *
 *   npm run db:migrate
 *
 * drizzle-kit's own migrate command wants its config file and its own
 * connection handling, so this runs the migrator in-process instead.
 */
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../lib/db/index.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
await migrate(db as any, { migrationsFolder: "./drizzle" });
console.log("migrated");

process.exit(0);
