/**
 * Reports what is actually in a database. Run it against production to check a
 * deploy without guessing:
 *
 *   DATABASE_URL="postgres://...-pooler...neon.tech/neondb?sslmode=require" npm run status
 *
 * With no DATABASE_URL it reports on the local PGlite database instead.
 */
import { desc, eq, sql } from "drizzle-orm";
import { db, usingPglite } from "../lib/db/index.ts";
import { games, inviteKeys, picks, syncState, teams, users } from "../lib/db/schema.ts";
import { currentSeason } from "../lib/nfl/season.ts";

const season = currentSeason();
console.log(`\ndatabase: ${usingPglite ? "local PGlite (.pglite/)" : "remote Postgres"}`);
console.log(`season:   ${season}\n`);

const [{ c: userCount }] = await db.select({ c: sql<number>`count(*)::int` }).from(users);
const [{ c: pickCount }] = await db.select({ c: sql<number>`count(*)::int` }).from(picks);
const [{ c: teamCount }] = await db.select({ c: sql<number>`count(*)::int` }).from(teams);

console.log(`  teams            ${teamCount}${teamCount === 32 ? "" : "   <- expected 32, run: npm run seed:teams"}`);
console.log(`  members          ${userCount}`);
console.log(`  picks            ${pickCount}`);

const seasons = await db
  .select({ s: games.season, c: sql<number>`count(*)::int` })
  .from(games)
  .groupBy(games.season)
  .orderBy(games.season);

console.log(
  `  games            ${seasons.map((r) => `${r.s}: ${r.c}`).join("  ") || "none   <- run: npm run sync"}`,
);

const thisSeason = seasons.find((r) => r.s === season);
if (!thisSeason) {
  console.log(`\n  ! no ${season} games loaded. Run: npm run sync`);
}

/* invite keys */
const keys = await db.select().from(inviteKeys).orderBy(desc(inviteKeys.createdAt));
const live = keys.filter(
  (k) =>
    k.revokedAt === null &&
    k.usedCount < k.maxUses &&
    (k.expiresAt === null || k.expiresAt > new Date()),
);
console.log(`\n  invite keys      ${keys.length} total, ${live.length} still usable`);
for (const k of live) {
  console.log(`    ${k.code}  ${k.usedCount}/${k.maxUses} used${k.label ? `  (${k.label})` : ""}`);
}
if (keys.length > 0 && live.length === 0) {
  console.log("    none usable — run: npm run invite");
}

/* members and who is an admin right now */
if (userCount > 0) {
  const members = await db
    .select({ n: users.username, a: users.isAdmin })
    .from(users)
    .orderBy(users.usernameLower);
  const declared = (process.env.ADMIN_USERNAMES ?? "").trim();
  console.log(`\n  members:`);
  for (const m of members) {
    const isAdmin = declared
      ? declared.split(",").map((s) => s.trim().toLowerCase()).includes(m.n.toLowerCase())
      : m.a;
    console.log(`    ${isAdmin ? "admin " : "member"}  ${m.n}`);
  }
  console.log(
    `  ADMIN_USERNAMES  ${declared || "(unset — falls back to the stored flag)"}`,
  );
  if (declared) {
    const known = members.map((m) => m.n.toLowerCase());
    for (const name of declared.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (!known.includes(name.toLowerCase())) {
        console.log(`    ! "${name}" is listed as an admin but no such account exists yet`);
      }
    }
  }
}

/* freshness */
const [lastSync] = await db
  .select()
  .from(syncState)
  .where(sql`${syncState.key} like 'sb:%'`)
  .orderBy(desc(syncState.lastSyncedAt))
  .limit(1);

if (lastSync) {
  const mins = Math.round((Date.now() - lastSync.lastSyncedAt.getTime()) / 60_000);
  console.log(`\n  last sync        ${mins} min ago (${lastSync.key})`);
}
const failures = await db.select().from(syncState).where(sql`${syncState.lastError} is not null`);
if (failures.length > 0) {
  console.log(`  ! ${failures.length} week(s) with sync errors:`);
  for (const f of failures.slice(0, 5)) console.log(`    ${f.key}: ${f.lastError}`);
}

console.log();
process.exit(0);
