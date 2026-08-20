/**
 * Pulls schedule, scores and lines into the database.
 *
 *   npm run sync                    # current season, all weeks
 *   npm run sync -- 2025            # a specific season
 *   npm run sync -- 2026 1 4        # season, first ordinal, last ordinal
 *
 * Safe to re-run: every write is an upsert, and the spread-freeze rule means a
 * re-sync after kickoff never blanks a stored line.
 */
import { syncWeekIfStale } from "../lib/espn/sync.ts";
import { LAST_ORDINAL, currentSeason, weekRef } from "../lib/nfl/season.ts";

const [seasonArg, fromArg, toArg] = process.argv.slice(2);

const season = seasonArg ? Number(seasonArg) : currentSeason();
const from = fromArg ? Number(fromArg) : 1;
const to = toArg ? Number(toArg) : LAST_ORDINAL;

if (!Number.isInteger(season)) throw new Error(`Bad season: ${seasonArg}`);

console.log(`syncing season ${season}, weeks ${from}–${to}`);

let games = 0;
for (let ordinal = from; ordinal <= to; ordinal++) {
  const ref = weekRef(ordinal);
  const fetched = await syncWeekIfStale(season, ordinal, { force: true });
  process.stdout.write(`  ${ref.label.padEnd(12)} ${fetched ? "ok" : "no data"}\n`);
  if (fetched) games++;
  // Be a considerate client of a free undocumented API.
  await new Promise((r) => setTimeout(r, 250));
}

console.log(`${games} week(s) synced`);
process.exit(0);
