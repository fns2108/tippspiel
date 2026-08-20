import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { games, syncState, teams } from "@/lib/db/schema";
import { fetchTeams, fetchWeek, type NormalizedGame } from "@/lib/espn/client";
import { weekRef } from "@/lib/nfl/season";

const MINUTE = 60_000;

/**
 * How stale a week's data may get before a page view triggers a refetch.
 * Vercel's free plan can only run one scheduled job per day, so freshness is
 * driven by whoever is looking at the site — which, on a Sunday evening, is
 * exactly when it needs to be fast.
 */
function stalenessBudgetMs(rows: { status: string; kickoff: Date }[]): number {
  const now = Date.now();

  if (rows.some((g) => g.status === "in")) return 20_000;

  const kickingOffSoon = rows.some((g) => {
    const delta = g.kickoff.getTime() - now;
    return g.status === "pre" && delta > 0 && delta < 30 * MINUTE;
  });
  if (kickingOffSoon) return MINUTE;

  // A game that has started but the feed still calls 'pre' (or just ended) —
  // keep checking briskly for a few hours.
  const recentlyLive = rows.some((g) => {
    const since = now - g.kickoff.getTime();
    return since > -MINUTE && since < 5 * 60 * MINUTE;
  });
  if (recentlyLive) return MINUTE;

  if (rows.some((g) => g.status !== "post")) return 15 * MINUTE;

  return 24 * 60 * MINUTE;
}

async function readSyncedAt(key: string): Promise<Date | null> {
  const [row] = await db
    .select({ at: syncState.lastSyncedAt })
    .from(syncState)
    .where(eq(syncState.key, key));
  return row?.at ?? null;
}

async function markSynced(key: string, error: string | null) {
  await db
    .insert(syncState)
    .values({ key, lastSyncedAt: new Date(), lastError: error })
    .onConflictDoUpdate({
      target: syncState.key,
      set: { lastSyncedAt: new Date(), lastError: error },
    });
}

/* --------------------------------------------------------------- teams */

export async function syncTeams(): Promise<number> {
  const list = await fetchTeams();
  if (list.length === 0) return 0;

  for (const t of list) {
    await db
      .insert(teams)
      .values({
        id: t.id,
        abbrev: t.abbrev,
        location: t.location,
        name: t.name,
        displayName: t.displayName,
        color: t.color,
        altColor: t.altColor,
      })
      .onConflictDoUpdate({
        target: teams.id,
        set: {
          abbrev: t.abbrev,
          location: t.location,
          name: t.name,
          displayName: t.displayName,
          color: t.color,
          altColor: t.altColor,
        },
      });
  }
  await markSynced("teams", null);
  return list.length;
}

/* --------------------------------------------------------------- games */

async function upsertGames(list: NormalizedGame[]) {
  // A playoff round whose participants are not decided yet comes back with
  // placeholder competitors that are not real teams. Those rows would fail the
  // foreign key, so the round is simply skipped until the field is set — which
  // is also when it becomes pickable.
  const known = new Set(
    (await db.select({ id: teams.id }).from(teams)).map((t) => t.id),
  );

  const skipped = list.filter(
    (g) => !known.has(g.homeTeamId) || !known.has(g.awayTeamId),
  );
  if (skipped.length > 0) {
    console.info(
      `[sync] skipping ${skipped.length} game(s) with undecided participants`,
    );
  }

  for (const g of list) {
    if (!known.has(g.homeTeamId) || !known.has(g.awayTeamId)) continue;
    await db
      .insert(games)
      .values({
        id: g.id,
        season: g.season,
        seasonType: g.seasonType,
        week: g.week,
        kickoff: g.kickoff,
        homeTeamId: g.homeTeamId,
        awayTeamId: g.awayTeamId,
        neutralSite: g.neutralSite,
        status: g.status,
        statusDetail: g.statusDetail,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        winnerTeamId: g.winnerTeamId,
        isTie: g.isTie,
        spread: g.spread === null ? null : String(g.spread),
        spreadDetail: g.spreadDetail,
        overUnder: g.overUnder === null ? null : String(g.overUnder),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: games.id,
        set: {
          // Kickoff times move — the NFL flexes games between windows.
          week: g.week,
          kickoff: g.kickoff,
          status: g.status,
          statusDetail: g.statusDetail,
          homeScore: g.homeScore,
          awayScore: g.awayScore,
          winnerTeamId: g.winnerTeamId,
          isTie: g.isTie,
          // ESPN drops odds the moment a game starts. COALESCE keeps the last
          // published line instead of blanking the historical record.
          spread: sql`coalesce(${g.spread === null ? null : String(g.spread)}::numeric, ${games.spread})`,
          spreadDetail: sql`coalesce(${g.spreadDetail}::text, ${games.spreadDetail})`,
          overUnder: sql`coalesce(${g.overUnder === null ? null : String(g.overUnder)}::numeric, ${games.overUnder})`,
          updatedAt: new Date(),
        },
        // An admin-corrected result is authoritative; the feed stops touching it.
        setWhere: eq(games.manualOverride, false),
      });
  }
}

/**
 * Refresh one week if its data has gone stale. Returns whether a fetch happened.
 *
 * Never throws: a failed sync leaves the last-known state in place and records
 * the error, because a page render must not depend on a third party being up.
 */
export async function syncWeekIfStale(
  season: number,
  ordinal: number,
  opts: { force?: boolean } = {},
): Promise<boolean> {
  const ref = weekRef(ordinal);
  const key = `sb:${season}:${ref.seasonType}:${ref.week}`;

  const existing = await db
    .select({ status: games.status, kickoff: games.kickoff })
    .from(games)
    .where(
      and(
        eq(games.season, season),
        eq(games.seasonType, ref.seasonType),
        eq(games.week, ref.week),
      ),
    );

  if (!opts.force) {
    const lastSynced = await readSyncedAt(key);
    if (lastSynced) {
      const age = Date.now() - lastSynced.getTime();
      if (age < stalenessBudgetMs(existing)) return false;
    }
  }

  try {
    const list = await fetchWeek(season, ref.seasonType, ref.week);
    if (list.length > 0) await upsertGames(list);
    await markSynced(key, null);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Still stamp the time so a hard upstream outage cannot turn into a retry
    // storm on every page view.
    await markSynced(key, message);
    console.error(`[sync] ${key} failed:`, message);
    return false;
  }
}
