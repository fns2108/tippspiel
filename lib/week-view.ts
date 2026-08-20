import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { syncWeekIfStale } from "@/lib/espn/sync";
import { SERVER_TZ, formatTime, nflDayKey, nflDayLabel } from "@/lib/format";
import { allWeekRefs, weekRef } from "@/lib/nfl/season";
import { getMyPicks, getVisiblePicks, getWeekGames, type GameView } from "@/lib/queries";
import type { GameCard, PickedBy } from "@/components/pick-row";
import type { RailWeek } from "@/components/week-rail";

/** Dates and numerics cross into client components as plain values. */
export function toGameCard(g: GameView): GameCard {
  return {
    id: g.id,
    kickoffIso: g.kickoff.toISOString(),
    kickoffFallback: formatTime(g.kickoff, SERVER_TZ),
    neutralSite: g.neutralSite,
    status: g.status,
    statusDetail: g.statusDetail,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    winnerTeamId: g.winnerTeamId,
    isTie: g.isTie,
    spread: g.spread,
    locked: g.locked,
    home: g.home,
    away: g.away,
  };
}

export type DayGroup = { key: string; label: string; games: GameView[] };

/** Games bucketed into NFL days (US Eastern), in kickoff order. */
export function groupByNflDay(list: GameView[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const g of list) {
    const key = nflDayKey(g.kickoff);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: nflDayLabel(g.kickoff), games: [] };
      groups.set(key, group);
    }
    group.games.push(g);
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export async function buildWeekRail(season: number, current: number): Promise<RailWeek[]> {
  const rows = await db
    .select({
      seasonType: games.seasonType,
      week: games.week,
      total: sql<number>`count(*)::int`,
      final: sql<number>`count(*) filter (where ${games.status} = 'post')::int`,
    })
    .from(games)
    .where(eq(games.season, season))
    .groupBy(games.seasonType, games.week);

  const loaded = new Map(rows.map((r) => [`${r.seasonType}:${r.week}`, r]));

  return allWeekRefs().map((ref) => {
    const row = loaded.get(`${ref.seasonType}:${ref.week}`);
    return {
      ordinal: ref.ordinal,
      short: ref.isPostseason ? ref.short : String(ref.ordinal),
      label: ref.label,
      available: row !== undefined && row.total > 0,
      complete: row !== undefined && row.total > 0 && row.final === row.total,
    };
  });
}

export type WeekView = {
  ref: ReturnType<typeof weekRef>;
  groups: DayGroup[];
  cards: Map<string, GameCard>;
  myPicks: Map<string, string>;
  pickedByGame: Map<string, PickedBy[]>;
  totalGames: number;
  openGames: GameView[];
  unpicked: GameView[];
  nextLock: GameView | null;
  liveCount: number;
};

/**
 * Everything one week's pages need, with the freshness check folded in.
 *
 * The sync is deliberately part of the render path: with no paid cron
 * available, whoever opens the page is what keeps scores current — and on a
 * Sunday evening that is exactly the right moment for it to happen.
 */
export async function loadWeekView(
  season: number,
  ordinal: number,
  userId: string,
): Promise<WeekView> {
  await syncWeekIfStale(season, ordinal);

  const now = new Date();
  const ref = weekRef(ordinal);
  const list = await getWeekGames(season, ordinal, now);

  const [myPicks, visible] = await Promise.all([
    getMyPicks(
      userId,
      list.map((g) => g.id),
    ),
    getVisiblePicks(season, ordinal, now),
  ]);

  const pickedByGame = new Map<string, PickedBy[]>();
  for (const v of visible) {
    const arr = pickedByGame.get(v.gameId);
    if (arr) arr.push(v);
    else pickedByGame.set(v.gameId, [v]);
  }
  for (const arr of pickedByGame.values()) {
    arr.sort((a, b) => a.username.localeCompare(b.username));
  }

  const openGames = list.filter((g) => !g.locked);
  const unpicked = openGames.filter((g) => !myPicks.has(g.id));

  return {
    ref,
    groups: groupByNflDay(list),
    cards: new Map(list.map((g) => [g.id, toGameCard(g)])),
    myPicks,
    pickedByGame,
    totalGames: list.length,
    openGames,
    unpicked,
    nextLock: openGames[0] ?? null,
    liveCount: list.filter((g) => g.status === "in").length,
  };
}
