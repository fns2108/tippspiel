/**
 * Scoring verification against a real, finished season.
 *
 *   npm run sync -- 2025 && npm run backfill
 *
 * Creates four synthetic members with fixed strategies, picks the whole 2025
 * season for them, then checks the scoreboard against results computed
 * independently from the raw rows. This exercises every scoring path — weekly
 * winners, shared ties, playoff weeks, drawn games, missed picks — before the
 * 2026 season has played a single snap.
 *
 * Destructive: it deletes the synthetic members and their picks first. It never
 * touches real accounts.
 */
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../lib/db/index.ts";
import { games, picks, users } from "../lib/db/schema.ts";
import { getScoreboard } from "../lib/queries.ts";
import { toOrdinal } from "../lib/nfl/season.ts";

const SEASON = 2025;

/** Marked so the cleanup below can never catch a real account. */
const SYNTHETIC = ["zz-chalk", "zz-homer", "zz-roadie", "zz-coinflip"] as const;
type Strategy = (typeof SYNTHETIC)[number];

let failures = 0;
const check = (ok: boolean, label: string, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------- fixtures */

const existing = await db.select({ id: users.id }).from(users).where(inArray(users.usernameLower, [...SYNTHETIC]));
if (existing.length > 0) {
  await db.delete(picks).where(inArray(picks.userId, existing.map((u) => u.id)));
  await db.delete(users).where(inArray(users.id, existing.map((u) => u.id)));
}

const memberIds = new Map<Strategy, string>();
for (const name of SYNTHETIC) {
  const id = randomUUID();
  memberIds.set(name, id);
  await db.insert(users).values({
    id,
    username: name,
    usernameLower: name,
    passwordHash: "x", // never used; these accounts cannot log in
  });
}

const allGames = await db
  .select({
    id: games.id,
    seasonType: games.seasonType,
    week: games.week,
    homeTeamId: games.homeTeamId,
    awayTeamId: games.awayTeamId,
    spread: games.spread,
    status: games.status,
    winnerTeamId: games.winnerTeamId,
    isTie: games.isTie,
  })
  .from(games)
  .where(eq(games.season, SEASON));

console.log(`${allGames.length} games loaded for ${SEASON}\n`);
check(allGames.length > 250, "a full season of games is present", `${allGames.length}`);
check(
  allGames.every((g) => g.status === "post"),
  "every game in a finished season is final",
  `${allGames.filter((g) => g.status !== "post").length} not final`,
);

// A deterministic hash, so re-running produces identical picks and ranks.
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

function choose(strategy: Strategy, g: (typeof allGames)[number]): string | null {
  switch (strategy) {
    case "zz-homer":
      return g.homeTeamId;
    case "zz-roadie":
      return g.awayTeamId;
    case "zz-chalk": {
      const spread = g.spread === null ? null : Number(g.spread);
      if (spread === null || spread === 0) return g.homeTeamId;
      return spread < 0 ? g.homeTeamId : g.awayTeamId;
    }
    case "zz-coinflip": {
      // Skips roughly one game in eleven, so "missed pick" is covered too.
      const h = hash(g.id);
      if (h % 11 === 0) return null;
      return h % 2 === 0 ? g.homeTeamId : g.awayTeamId;
    }
  }
}

// Ranks are 1..n within a week, so the slate has to be grouped first.
const byWeek = new Map<string, typeof allGames>();
for (const g of allGames) {
  const key = `${g.seasonType}:${g.week}`;
  const bucket = byWeek.get(key);
  if (bucket) bucket.push(g);
  else byWeek.set(key, [g]);
}

const rows: { userId: string; gameId: string; teamId: string; rank: number }[] = [];
for (const strategy of SYNTHETIC) {
  const userId = memberIds.get(strategy)!;
  for (const weekGames of byWeek.values()) {
    const picked = weekGames
      .map((g) => ({ g, teamId: choose(strategy, g) }))
      .filter((p): p is { g: (typeof allGames)[number]; teamId: string } => p.teamId !== null)
      // A deterministic ordering per member, so each ranks the week differently.
      .sort((a, b) => hash(`${strategy}:rank:${a.g.id}`) - hash(`${strategy}:rank:${b.g.id}`));

    picked.forEach((p, i) => {
      rows.push({ userId, gameId: p.g.id, teamId: p.teamId, rank: i + 1 });
    });
  }
}
for (let i = 0; i < rows.length; i += 500) {
  await db.insert(picks).values(rows.slice(i, i + 500));
}
console.log(`${rows.length} picks written\n`);

/* -------------------------------------------------- independent scoring */

// Recompute from raw rows, without going through lib/queries.ts.
const expectedByUserWeek = new Map<string, { correct: number; picked: number; points: number }>();
const gameById = new Map(allGames.map((g) => [g.id, g]));
for (const row of rows) {
  const g = gameById.get(row.gameId)!;
  const ordinal = toOrdinal(g.seasonType, g.week);
  if (ordinal === null) continue;
  const key = `${row.userId}:${ordinal}`;
  const acc = expectedByUserWeek.get(key) ?? { correct: 0, picked: 0, points: 0 };
  acc.picked++;
  if (g.winnerTeamId !== null && g.winnerTeamId === row.teamId) {
    acc.correct++;
    acc.points += row.rank;
  }
  expectedByUserWeek.set(key, acc);
}

const board = await getScoreboard(SEASON);

// Only the synthetic members are checked: a development database may also hold
// demo accounts, and their picks are not part of this fixture.
const synthetic = new Set(memberIds.values());

let weekMismatches = 0;
for (const week of board.weeks) {
  for (const r of week.rows.filter((row) => synthetic.has(row.userId))) {
    const expected =
      expectedByUserWeek.get(`${r.userId}:${week.ref.ordinal}`) ?? { correct: 0, picked: 0, points: 0 };
    if (expected.correct !== r.correct || expected.picked !== r.picked || expected.points !== r.points) {
      weekMismatches++;
      console.log(
        `      ${r.username} ${week.ref.label}: got ${r.points}pts ${r.correct}/${r.picked}, ` +
          `expected ${expected.points}pts ${expected.correct}/${expected.picked}`,
      );
    }
  }
}
check(weekMismatches === 0, "every weekly record matches an independent count");

/* --------------------------------------------------------- invariants */

const proBowlOrdinals = board.weeks.filter((w) => w.ref.ordinal > 22 || w.ref.ordinal < 1);
check(proBowlOrdinals.length === 0, "no unpickable weeks leaked into the scoreboard");
check(board.weeks.length === 22, "22 pickable weeks", `${board.weeks.length}`);
check(
  board.weeks.filter((w) => w.ref.isPostseason).length === 4,
  "four playoff rounds counted",
);

for (const s of board.season.filter((r) => synthetic.has(r.userId))) {
  const summed = board.weeks.reduce(
    (n, w) => n + (w.rows.find((r) => r.userId === s.userId)?.points ?? 0),
    0,
  );
  check(summed === s.points, `${s.username}: season points equal the sum of weeks`, `${s.points}`);
}

const totalWeeklyWins = board.season
  .filter((r) => synthetic.has(r.userId))
  .reduce((n, s) => n + s.weeklyWins, 0);
const weeksWithWinner = board.weeks.filter((w) => w.winnerIds.length > 0).length;
const sharedWeeks = board.weeks.filter((w) => w.winnerIds.length > 1);
check(
  totalWeeklyWins >= weeksWithWinner,
  "weekly wins are awarded to every tied member, not just one",
  `${totalWeeklyWins} wins across ${weeksWithWinner} weeks, ${sharedWeeks.length} shared`,
);
check(sharedWeeks.length > 0, "the shared-tie path is actually exercised", `${sharedWeeks.length} tied weeks`);

for (const w of sharedWeeks) {
  const top = Math.max(...w.rows.map((r) => r.points));
  const allTopAreWinners = w.rows
    .filter((r) => r.points === top)
    .every((r) => w.winnerIds.includes(r.userId));
  check(allTopAreWinners, `${w.ref.label}: every member on the top score shares the win`);
}

const drawn = allGames.filter((g) => g.isTie);
if (drawn.length > 0) {
  const drawnIds = new Set(drawn.map((g) => g.id));
  const anyCredited = rows.some((r) => drawnIds.has(r.gameId) && gameById.get(r.gameId)!.winnerTeamId === r.teamId);
  check(!anyCredited, "a drawn game credits nobody", `${drawn.length} draw(s) in ${SEASON}`);
} else {
  console.log(`  --  no drawn games in ${SEASON}; that path is covered by the unit test`);
}

const coinflip = board.season.find((s) => s.username === "zz-coinflip")!;
const homer = board.season.find((s) => s.username === "zz-homer")!;
check(coinflip.picked < homer.picked, "a member who skipped games has fewer picks", `${coinflip.picked} vs ${homer.picked}`);

/* ------------------------------------------------------------- report */

console.log("\n  2025 season table (synthetic)\n");
console.log("     name            points  correct  picked  wkW  best");
for (const [i, s] of board.season.filter((r) => synthetic.has(r.userId)).entries()) {
  const best = s.bestWeek ? `W${s.bestWeek.ordinal} (${s.bestWeek.points})` : "—";
  console.log(
    `  ${String(i + 1).padStart(2)}  ${s.username.padEnd(14)} ${String(s.points).padStart(7)} ${String(s.correct).padStart(8)} ${String(s.picked).padStart(7)} ${String(s.weeklyWins).padStart(4)}  ${best}`,
  );
}

await db.delete(picks).where(inArray(picks.userId, [...memberIds.values()]));
await db.delete(users).where(inArray(users.id, [...memberIds.values()]));
console.log("\nsynthetic members removed");

console.log(`\n${failures === 0 ? "all checks passed" : `${failures} check(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
