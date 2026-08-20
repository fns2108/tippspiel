/**
 * Wipes the local PGlite database and rebuilds it from scratch.
 *
 *   npm run db:reset
 *
 * PGlite is an in-process Postgres, and Next's dev server can run more than one
 * worker process. If two of them open the data directory at once it aborts, and
 * the directory does not always survive. Nothing in it is precious — schedule
 * and results come back from ESPN — so the fix is to rebuild rather than repair.
 *
 * Refuses to touch a real Postgres.
 */
import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

const url = process.env.DATABASE_URL?.trim() ?? "";
if (url !== "" && !url.startsWith("pglite://")) {
  console.error("DATABASE_URL points at a real Postgres. Refusing to wipe it.");
  process.exit(1);
}

const dir = url.startsWith("pglite://") ? url.slice("pglite://".length) : ".pglite";
console.log(`removing ${dir}/`);
rmSync(dir, { recursive: true, force: true });

const run = (args: string[]) => {
  const label = args.join(" ");
  console.log(`\n> npm run ${label}`);
  const res = spawnSync("npm", ["run", ...args], { stdio: "inherit" });
  if (res.status !== 0) {
    console.error(`\n"${label}" failed.`);
    process.exit(res.status ?? 1);
  }
};

run(["db:migrate"]);
run(["seed:teams"]);
run(["sync"]);

console.log("\nRebuilt. Run `npm run invite` for a key, or `npm run seed:demo` for demo data.");
