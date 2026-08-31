import "server-only";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { games, picks, teams, users } from "@/lib/db/schema";
import { toOrdinal, weekRef, type WeekRef } from "@/lib/nfl/season";
import { isLocked } from "@/lib/pick-rules";

export type TeamView = {
  id: string;
  abbrev: string;
  location: string;
  name: string;
  displayName: string;
  color: string | null;
  altColor: string | null;
};

export type GameView = {
  id: string;
  kickoff: Date;
  neutralSite: boolean;
  status: "pre" | "in" | "post";
  statusDetail: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamId: string | null;
  isTie: boolean;
  spread: number | null;
  spreadDetail: string | null;
  overUnder: number | null;
  home: TeamView;
  away: TeamView;
  /** Derived from kickoff, never from feed status — this is the lock. */
  locked: boolean;
};

/**
 * A game is locked — no more picks, everyone's picks visible — from its own
 * kickoff. Shared with the write path in lib/pick-rules.ts so reads and writes
 * can never disagree about what "locked" means.
 */
export { isLocked };

function toGameView(row: Record<string, unknown>, now: Date): GameView {
  const kickoff = row.kickoff as Date;
  const numeric = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    id: row.id as string,
    kickoff,
    neutralSite: row.neutralSite as boolean,
    status: row.status as "pre" | "in" | "post",
    statusDetail: (row.statusDetail as string | null) ?? null,
    homeScore: row.homeScore as number | null,
    awayScore: row.awayScore as number | null,
    winnerTeamId: (row.winnerTeamId as string | null) ?? null,
    isTie: row.isTie as boolean,
    spread: numeric(row.spread),
    spreadDetail: (row.spreadDetail as string | null) ?? null,
    overUnder: numeric(row.overUnder),
    home: row.home as TeamView,
    away: row.away as TeamView,
    locked: isLocked(kickoff, now),
  };
}

export async function getWeekGames(
  season: number,
  ordinal: number,
  now: Date = new Date(),
): Promise<GameView[]> {
  const ref = weekRef(ordinal);
  const home = db.select().from(teams).as("home_team");
  const away = db.select().from(teams).as("away_team");

  const rows = await db
    .select({
      id: games.id,
      kickoff: games.kickoff,
      neutralSite: games.neutralSite,
      status: games.status,
      statusDetail: games.statusDetail,
      homeScore: games.homeScore,
      awayScore: games.awayScore,
      winnerTeamId: games.winnerTeamId,
      isTie: games.isTie,
      spread: games.spread,
      spreadDetail: games.spreadDetail,
      overUnder: games.overUnder,
      home: {
        id: home.id,
        abbrev: home.abbrev,
        location: home.location,
        name: home.name,
        displayName: home.displayName,
        color: home.color,
        altColor: home.altColor,
      },
      away: {
        id: away.id,
        abbrev: away.abbrev,
        location: away.location,
        name: away.name,
        displayName: away.displayName,
        color: away.color,
        altColor: away.altColor,
      },
    })
    .from(games)
    .innerJoin(home, eq(home.id, games.homeTeamId))
    .innerJoin(away, eq(away.id, games.awayTeamId))
    .where(
      and(
        eq(games.season, season),
        eq(games.seasonType, ref.seasonType),
        eq(games.week, ref.week),
      ),
    )
    .orderBy(asc(games.kickoff), asc(games.id));

  return rows.map((r) => toGameView(r as Record<string, unknown>, now));
}

/** The signed-in user's own picks. Always visible to them, locked or not. */
export type MyPick = { teamId: string; rank: number | null };

export async function getMyPicks(
  userId: string,
  gameIds: string[],
): Promise<Map<string, MyPick>> {
  if (gameIds.length === 0) return new Map();
  const rows = await db
    .select({ gameId: picks.gameId, teamId: picks.teamId, rank: picks.rank })
    .from(picks)
    .where(and(eq(picks.userId, userId), inArray(picks.gameId, gameIds)));
  return new Map(rows.map((r) => [r.gameId, { teamId: r.teamId, rank: r.rank }]));
}

export type VisiblePick = {
  userId: string;
  username: string;
  gameId: string;
  teamId: string;
  rank: number | null;
};

/**
 * Everyone's picks for games that have already kicked off.
 *
 * The kickoff filter is in the WHERE clause on purpose: an un-started game's
 * picks never enter the response at all, so there is nothing to hide in the
 * markup and nothing to leak through a JSON payload.
 */
export async function getVisiblePicks(
  season: number,
  ordinal: number,
  now: Date = new Date(),
): Promise<VisiblePick[]> {
  const ref = weekRef(ordinal);
  return db
    .select({
      userId: picks.userId,
      username: users.username,
      gameId: picks.gameId,
      teamId: picks.teamId,
      rank: picks.rank,
    })
    .from(picks)
    .innerJoin(games, eq(games.id, picks.gameId))
    .innerJoin(users, eq(users.id, picks.userId))
    .where(
      and(
        eq(games.season, season),
        eq(games.seasonType, ref.seasonType),
        eq(games.week, ref.week),
        lte(games.kickoff, now),
      ),
    );
}

/* --------------------------------------------------------- season table */

export type WeekStanding = {
  userId: string;
  username: string;
  /** Ranks earned on correct picks — what actually wins the week. */
  points: number;
  correct: number;
  picked: number;
  decided: number;
};

export type WeekSummary = {
  ref: WeekRef;
  totalGames: number;
  finalGames: number;
  /** Every game played — the weekly winner is settled. */
  complete: boolean;
  started: boolean;
  rows: WeekStanding[];
  /** May hold several ids: a tied week is shared, per the pool's rules. */
  winnerIds: string[];
};

export type SeasonStanding = {
  userId: string;
  username: string;
  points: number;
  correct: number;
  picked: number;
  decided: number;
  weeklyWins: number;
  /** Shared weekly wins counted separately, for the "won outright" nuance. */
  sharedWins: number;
  bestWeek: { ordinal: number; points: number; correct: number } | null;
};

export type Scoreboard = {
  members: { id: string; username: string }[];
  weeks: WeekSummary[];
  season: SeasonStanding[];
};

/**
 * Everything the standings and analytics pages need, from two aggregates.
 *
 * Standings are computed rather than stored: at this scale it costs nothing,
 * and it means an admin correcting a result cannot leave a stale total behind.
 */
export async function getScoreboard(season: number, now: Date = new Date()): Promise<Scoreboard> {
  // ISO string with an explicit cast, never a Date: a timestamp interpolated
  // into `sql` carries no column, so drizzle's mapper never runs and the raw
  // object reaches the driver. See the note in lib/rate-limit.ts.
  const nowSql = now.toISOString();

  const members = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .orderBy(asc(users.usernameLower));

  const gameRows = await db
    .select({
      seasonType: games.seasonType,
      week: games.week,
      total: sql<number>`count(*)::int`,
      final: sql<number>`count(*) filter (where ${games.status} = 'post')::int`,
      started: sql<number>`count(*) filter (where ${games.kickoff} <= ${nowSql}::timestamptz)::int`,
    })
    .from(games)
    .where(eq(games.season, season))
    .groupBy(games.seasonType, games.week);

  const pickRows = await db
    .select({
      userId: picks.userId,
      seasonType: games.seasonType,
      week: games.week,
      picked: sql<number>`count(*)::int`,
      decided: sql<number>`count(*) filter (where ${games.status} = 'post')::int`,
      correct: sql<number>`count(*) filter (where ${games.winnerTeamId} = ${picks.teamId})::int`,
      // An unranked pick is worth nothing, which is what makes ranking the
      // whole slate the thing you have to do.
      points: sql<number>`coalesce(sum(${picks.rank}) filter (where ${games.winnerTeamId} = ${picks.teamId}), 0)::int`,
    })
    .from(picks)
    .innerJoin(games, eq(games.id, picks.gameId))
    .where(eq(games.season, season))
    .groupBy(picks.userId, games.seasonType, games.week);

  const nameById = new Map(members.map((m) => [m.id, m.username]));

  // Bucket both aggregates by week ordinal, dropping anything unpickable.
  type Bucket = { total: number; final: number; started: number };
  const buckets = new Map<number, Bucket>();
  for (const g of gameRows) {
    const ordinal = toOrdinal(g.seasonType, g.week);
    if (ordinal === null) continue;
    buckets.set(ordinal, { total: g.total, final: g.final, started: g.started });
  }

  const perWeek = new Map<number, Map<string, WeekStanding>>();
  for (const p of pickRows) {
    const ordinal = toOrdinal(p.seasonType, p.week);
    if (ordinal === null) continue;
    let byUser = perWeek.get(ordinal);
    if (!byUser) {
      byUser = new Map();
      perWeek.set(ordinal, byUser);
    }
    byUser.set(p.userId, {
      userId: p.userId,
      username: nameById.get(p.userId) ?? "—",
      points: p.points,
      correct: p.correct,
      picked: p.picked,
      decided: p.decided,
    });
  }

  const weeks: WeekSummary[] = [...buckets.keys()]
    .sort((a, b) => a - b)
    .map((ordinal) => {
      const bucket = buckets.get(ordinal)!;
      const byUser = perWeek.get(ordinal) ?? new Map<string, WeekStanding>();

      // Everyone appears every week, including members who picked nothing.
      const rows: WeekStanding[] = members.map(
        (m) =>
          byUser.get(m.id) ?? {
            userId: m.id,
            username: m.username,
            points: 0,
            correct: 0,
            picked: 0,
            decided: 0,
          },
      );
      // Points decide the week; correct picks only break a tie on points, and
      // the name only breaks a tie on both.
      rows.sort(
        (a, b) =>
          b.points - a.points || b.correct - a.correct || a.username.localeCompare(b.username),
      );

      const complete = bucket.total > 0 && bucket.final === bucket.total;
      const top = rows.length > 0 ? rows[0].points : 0;
      // A week nobody scored in has no winner — otherwise everyone "wins" 0.
      const winnerIds = complete && top > 0 ? rows.filter((r) => r.points === top).map((r) => r.userId) : [];

      return {
        ref: weekRef(ordinal),
        totalGames: bucket.total,
        finalGames: bucket.final,
        complete,
        started: bucket.started > 0,
        rows,
        winnerIds,
      };
    });

  const seasonByUser = new Map<string, SeasonStanding>(
    members.map((m) => [
      m.id,
      {
        userId: m.id,
        username: m.username,
        points: 0,
        correct: 0,
        picked: 0,
        decided: 0,
        weeklyWins: 0,
        sharedWins: 0,
        bestWeek: null,
      },
    ]),
  );

  for (const week of weeks) {
    for (const row of week.rows) {
      const acc = seasonByUser.get(row.userId);
      if (!acc) continue;
      acc.points += row.points;
      acc.correct += row.correct;
      acc.picked += row.picked;
      acc.decided += row.decided;
      if (!acc.bestWeek || row.points > acc.bestWeek.points) {
        if (row.decided > 0) {
          acc.bestWeek = { ordinal: week.ref.ordinal, points: row.points, correct: row.correct };
        }
      }
    }
    for (const id of week.winnerIds) {
      const acc = seasonByUser.get(id);
      if (!acc) continue;
      acc.weeklyWins += 1;
      if (week.winnerIds.length > 1) acc.sharedWins += 1;
    }
  }

  const seasonStandings = [...seasonByUser.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.correct - a.correct ||
      b.weeklyWins - a.weeklyWins ||
      a.username.localeCompare(b.username),
  );

  return { members, weeks, season: seasonStandings };
}

/* -------------------------------------------------------- team analytics */

export type TeamConsensus = {
  team: TeamView;
  timesPicked: number;
  timesCorrect: number;
  /** How many times this team appeared in a decided game anyone picked. */
  decided: number;
  /** Games the team actually played that are final. */
  appearances: number;
};

/**
 * How often the group backed each team and how often that was right.
 * Scoped to one week when `ordinal` is given, otherwise the whole season.
 */
export async function getTeamConsensus(
  season: number,
  ordinal?: number,
): Promise<TeamConsensus[]> {
  const scope = [eq(games.season, season)];
  if (ordinal !== undefined) {
    const ref = weekRef(ordinal);
    scope.push(eq(games.seasonType, ref.seasonType), eq(games.week, ref.week));
  }

  const rows = await db
    .select({
      teamId: picks.teamId,
      abbrev: teams.abbrev,
      location: teams.location,
      name: teams.name,
      displayName: teams.displayName,
      color: teams.color,
      altColor: teams.altColor,
      timesPicked: sql<number>`count(*)::int`,
      decided: sql<number>`count(*) filter (where ${games.status} = 'post')::int`,
      timesCorrect: sql<number>`count(*) filter (where ${games.winnerTeamId} = ${picks.teamId})::int`,
    })
    .from(picks)
    .innerJoin(games, eq(games.id, picks.gameId))
    .innerJoin(teams, eq(teams.id, picks.teamId))
    .where(and(...scope))
    .groupBy(
      picks.teamId,
      teams.abbrev,
      teams.location,
      teams.name,
      teams.displayName,
      teams.color,
      teams.altColor,
    );

  const appearanceRows = await db
    .select({
      teamId: sql<string>`t.id`,
      appearances: sql<number>`count(*)::int`,
    })
    .from(
      sql`(
        select ${games.homeTeamId} as id, ${games.status} as status, ${games.season} as season,
               ${games.seasonType} as season_type, ${games.week} as week from ${games}
        union all
        select ${games.awayTeamId} as id, ${games.status} as status, ${games.season} as season,
               ${games.seasonType} as season_type, ${games.week} as week from ${games}
      ) as t`,
    )
    .where(
      ordinal === undefined
        ? sql`t.season = ${season} and t.status = 'post'`
        : sql`t.season = ${season} and t.status = 'post' and t.season_type = ${weekRef(ordinal).seasonType} and t.week = ${weekRef(ordinal).week}`,
    )
    .groupBy(sql`t.id`);

  const appearancesById = new Map(appearanceRows.map((r) => [r.teamId, r.appearances]));

  return rows
    .map((r) => ({
      team: {
        id: r.teamId,
        abbrev: r.abbrev,
        location: r.location,
        name: r.name,
        displayName: r.displayName,
        color: r.color,
        altColor: r.altColor,
      },
      timesPicked: r.timesPicked,
      timesCorrect: r.timesCorrect,
      decided: r.decided,
      appearances: appearancesById.get(r.teamId) ?? 0,
    }))
    .sort((a, b) => b.timesPicked - a.timesPicked || a.team.abbrev.localeCompare(b.team.abbrev));
}

/** One member's record with each team they backed. */
export async function getUserTeamBreakdown(
  season: number,
  userId: string,
): Promise<TeamConsensus[]> {
  const rows = await db
    .select({
      teamId: picks.teamId,
      abbrev: teams.abbrev,
      location: teams.location,
      name: teams.name,
      displayName: teams.displayName,
      color: teams.color,
      altColor: teams.altColor,
      timesPicked: sql<number>`count(*)::int`,
      decided: sql<number>`count(*) filter (where ${games.status} = 'post')::int`,
      timesCorrect: sql<number>`count(*) filter (where ${games.winnerTeamId} = ${picks.teamId})::int`,
    })
    .from(picks)
    .innerJoin(games, eq(games.id, picks.gameId))
    .innerJoin(teams, eq(teams.id, picks.teamId))
    .where(and(eq(games.season, season), eq(picks.userId, userId)))
    .groupBy(
      picks.teamId,
      teams.abbrev,
      teams.location,
      teams.name,
      teams.displayName,
      teams.color,
      teams.altColor,
    );

  return rows
    .map((r) => ({
      team: {
        id: r.teamId,
        abbrev: r.abbrev,
        location: r.location,
        name: r.name,
        displayName: r.displayName,
        color: r.color,
        altColor: r.altColor,
      },
      timesPicked: r.timesPicked,
      timesCorrect: r.timesCorrect,
      decided: r.decided,
      appearances: 0,
    }))
    .sort((a, b) => b.timesPicked - a.timesPicked || a.team.abbrev.localeCompare(b.team.abbrev));
}

/** Games where two members picked differently, and who came out ahead. */
export async function getHeadToHead(
  season: number,
  aId: string,
  bId: string,
): Promise<{ disagreements: number; aWon: number; bWon: number }> {
  const other = db.select().from(picks).as("other");

  const [row] = await db
    .select({
      disagreements: sql<number>`count(*)::int`,
      aWon: sql<number>`count(*) filter (where ${games.winnerTeamId} = ${picks.teamId})::int`,
      bWon: sql<number>`count(*) filter (where ${games.winnerTeamId} = ${other.teamId})::int`,
    })
    .from(picks)
    .innerJoin(other, and(eq(other.gameId, picks.gameId), eq(other.userId, bId)))
    .innerJoin(games, eq(games.id, picks.gameId))
    .where(
      and(
        eq(picks.userId, aId),
        eq(games.season, season),
        eq(games.status, "post"),
        sql`${picks.teamId} <> ${other.teamId}`,
      ),
    );

  return row ?? { disagreements: 0, aWon: 0, bWon: 0 };
}

export async function findUserByUsername(
  username: string,
): Promise<{ id: string; username: string } | null> {
  const [row] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.usernameLower, username.trim().toLowerCase()));
  return row ?? null;
}

/* ------------------------------------------------------------- the week */

/**
 * The week the app should open on: the earliest one that still has an
 * unfinished game, falling back to the last week that exists.
 */
export async function getCurrentWeekOrdinal(season: number): Promise<number | null> {
  const rows = await db
    .select({
      seasonType: games.seasonType,
      week: games.week,
      unfinished: sql<number>`count(*) filter (where ${games.status} <> 'post')::int`,
    })
    .from(games)
    .where(eq(games.season, season))
    .groupBy(games.seasonType, games.week);

  const ordinals = rows
    .map((r) => ({ ordinal: toOrdinal(r.seasonType, r.week), unfinished: r.unfinished }))
    .filter((r): r is { ordinal: number; unfinished: number } => r.ordinal !== null)
    .sort((a, b) => a.ordinal - b.ordinal);

  if (ordinals.length === 0) return null;
  return (ordinals.find((r) => r.unfinished > 0) ?? ordinals[ordinals.length - 1]).ordinal;
}

/** Which week ordinals have games loaded, for the week rail. */
export async function getLoadedWeekOrdinals(season: number): Promise<number[]> {
  const rows = await db
    .select({ seasonType: games.seasonType, week: games.week })
    .from(games)
    .where(eq(games.season, season))
    .groupBy(games.seasonType, games.week);

  return rows
    .map((r) => toOrdinal(r.seasonType, r.week))
    .filter((o): o is number => o !== null)
    .sort((a, b) => a - b);
}
