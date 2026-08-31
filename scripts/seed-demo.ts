/**
 * Fills a season with believable members and picks, so the whole app can be
 * looked over before a real season starts.
 *
 *   npm run sync -- 2025          # the real schedule and results first
 *   npm run seed:demo -- 2025     # then eight members who picked it
 *   npm run seed:demo -- --clear  # and remove them again
 *
 * DESTRUCTIVE, AND THERE IS ONLY ONE DATABASE. Whatever `DATABASE_URL` points
 * at is what this writes to — there is no local mode. The members it creates
 * are members: they appear in the standings and the grid of every season, not
 * just the one being seeded.
 *
 * Real accounts are never touched. Demo accounts are recognised by their
 * password hash, which is a fixed sentinel rather than a real scrypt hash — so
 * they cannot log in, and no account created through the invite flow can ever
 * be mistaken for one.
 */
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../lib/db/index.ts";
import { games, picks, users } from "../lib/db/schema.ts";
import { currentSeason } from "../lib/nfl/season.ts";

/** Not a valid scrypt hash, so verifyPassword refuses it before doing any work. */
const DEMO_HASH = "demo-account-cannot-log-in";

/** Skill is the chance of taking the side that actually won. */
const CAST: { name: string; skill: number; skips: number }[] = [
  { name: "Jonas", skill: 0.68, skips: 0 },
  { name: "Marie", skill: 0.65, skips: 0 },
  { name: "Hendrik", skill: 0.62, skips: 0 },
  { name: "Lena", skill: 0.6, skips: 0 },
  { name: "Ben", skill: 0.58, skips: 0.02 },
  { name: "Sofia", skill: 0.55, skips: 0 },
  { name: "Til", skill: 0.52, skips: 0.05 },
  { name: "Annika", skill: 0.5, skips: 0 },
];

/* ----------------------------------------------------------------- clear */

async function clear(): Promise<number> {
  const demo = await db.select({ id: users.id }).from(users).where(eq(users.passwordHash, DEMO_HASH));
  if (demo.length === 0) return 0;
  const ids = demo.map((u) => u.id);
  await db.delete(picks).where(inArray(picks.userId, ids));
  await db.delete(users).where(inArray(users.id, ids));
  return ids.length;
}

if (process.argv.includes("--clear")) {
  const removed = await clear();
  console.log(removed === 0 ? "no demo members found" : `${removed} demo members removed`);
  process.exit(0);
}

/* ------------------------------------------------------------------ seed */

const season = Number(process.argv[2]) || currentSeason();

const allGames = await db
  .select({
    id: games.id,
    seasonType: games.seasonType,
    week: games.week,
    homeTeamId: games.homeTeamId,
    awayTeamId: games.awayTeamId,
    status: games.status,
    winnerTeamId: games.winnerTeamId,
  })
  .from(games)
  .where(eq(games.season, season));

if (allGames.length === 0) {
  console.error(`No games loaded for ${season}. Run: npm run sync -- ${season}`);
  process.exit(1);
}

// Re-running replaces rather than doubles up.
const replaced = await clear();
if (replaced > 0) console.log(`${replaced} existing demo members replaced`);

const ids = new Map<string, string>();
for (const { name } of CAST) {
  const id = randomUUID();
  ids.set(name, id);
  await db.insert(users).values({
    id,
    username: name,
    usernameLower: name.toLowerCase(),
    passwordHash: DEMO_HASH,
  });
}

/** Deterministic, so the same season always produces the same table. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

// Confidence ranks are per week, so the games have to be grouped before any
// can be handed out.
const byWeek = new Map<string, typeof allGames>();
for (const g of allGames) {
  const key = `${g.seasonType}:${g.week}`;
  const bucket = byWeek.get(key);
  if (bucket) bucket.push(g);
  else byWeek.set(key, [g]);
}

const rows: { userId: string; gameId: string; teamId: string; rank: number | null }[] = [];
for (const { name, skill, skips } of CAST) {
  const userId = ids.get(name)!;

  for (const weekGames of byWeek.values()) {
    const picked: { gameId: string; teamId: string; confidence: number }[] = [];

    for (const g of weekGames) {
      if (skips > 0 && hash(`${name}:skip:${g.id}`) < skips) continue;

      // An undecided game has no right answer to aim at, so it is a coin flip.
      const right = g.winnerTeamId;
      const roll = hash(`${name}:${g.id}`);
      const teamId = right
        ? roll < skill
          ? right
          : right === g.homeTeamId
            ? g.awayTeamId
            : g.homeTeamId
        : roll < 0.5
          ? g.homeTeamId
          : g.awayTeamId;

      // Sorting by a per-member, per-game number gives every member a
      // different ordering — which is the whole point of confidence picks.
      picked.push({ gameId: g.id, teamId, confidence: hash(`${name}:rank:${g.id}`) });
    }

    // Highest confidence takes the biggest number, 1..n over what they picked.
    picked.sort((a, b) => a.confidence - b.confidence);
    picked.forEach((pick, i) => {
      rows.push({ userId, gameId: pick.gameId, teamId: pick.teamId, rank: i + 1 });
    });
  }
}

for (let i = 0; i < rows.length; i += 500) {
  await db.insert(picks).values(rows.slice(i, i + 500));
}

const decided = allGames.filter((g) => g.winnerTeamId !== null).length;
console.log(`\nseason ${season}`);
console.log(`  games       ${allGames.length} (${decided} decided)`);
console.log(`  members     ${CAST.length}`);
console.log(`  picks       ${rows.length} (each week ranked 1..n)`);
console.log(`\nSet NFL_SEASON=${season} to make the app show this season.`);
console.log(`Remove it all again with: npm run seed:demo -- --clear`);

process.exit(0);
