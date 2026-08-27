import "server-only";
import { teamColors } from "@/lib/nfl/colors";
import { weekRef, type WeekRef } from "@/lib/nfl/season";
import { weekShareCents } from "@/lib/payouts";
import { getPoolSettings, payoutsFromBoard } from "@/lib/pool";
import { getScoreboard, getWeekGames, type Scoreboard } from "@/lib/queries";

/**
 * The week reduced to what fits in a picture.
 *
 * Built once and used by both the preview page and the PNG route, so the image
 * someone sends to the group is provably the same week they were looking at —
 * two hand-rolled queries would eventually disagree about a tie.
 */

export type ShareRow = {
  rank: number;
  username: string;
  correct: number;
  decided: number;
  /** Alone or shared at the top. Only meaningful once the week is complete. */
  leader: boolean;
  /** What this week pays them, in cents. Zero when the pool plays for nothing. */
  wonCents: number;
  /**
   * The overall season prize, in cents — carried only on the last payout week
   * of the season, which is the picture that settles the pool. Zero everywhere
   * else, including for the season winner in every other week.
   */
  seasonCents: number;
  /** The best-single-week prize, carried on the same picture as the season one. */
  bestWeekCents: number;
};

export type ShareGame = {
  away: string;
  home: string;
  awayScore: number | null;
  homeScore: number | null;
  /** Which side to set in the winner's colour, or null while undecided. */
  won: "home" | "away" | null;
  tie: boolean;
  final: boolean;
  colorHome: string;
  colorAway: string;
  neutral: boolean;
};

export type ShareCard = {
  season: number;
  ref: WeekRef;
  /** Every game played: the week's winner is settled. */
  complete: boolean;
  started: boolean;
  totalGames: number;
  finalGames: number;
  rows: ShareRow[];
  games: ShareGame[];
  /** Season table after this week, for the footer line. */
  seasonTop: { username: string; correct: number }[];
};

/**
 * @param ordinal a week, or null for the most recent one that has been played
 *   — which on a Monday is the week you opened the page to send.
 *
 * Resolving "latest" here rather than in a separate call is deliberate: the
 * scoreboard is the app's one expensive aggregate, and asking for it twice to
 * answer a question it already contains doubled the cost of the page's own
 * default route.
 */
export async function loadShareCard(
  season: number,
  ordinal: number | null,
): Promise<ShareCard> {
  const [board, settings] = await Promise.all([
    getScoreboard(season),
    getPoolSettings(season),
  ]);

  const resolved = ordinal ?? latestPlayed(board) ?? 1;
  const games = await getWeekGames(season, resolved);

  const payouts = payoutsFromBoard(settings, board);
  const paysThisWeek = payouts.enabled && payouts.payoutWeeks.includes(resolved);

  // The last payout week is the one that settles the season, so it is the only
  // picture that carries the overall prize — and only once every payout week
  // is actually complete, which is when that prize is assigned at all.
  const settlesSeason =
    payouts.seasonSettled &&
    payouts.payoutWeeks.at(-1) === resolved;

  const week = board.weeks.find((w) => w.ref.ordinal === resolved);
  const ref = weekRef(resolved);

  // Dense ranking: a tie shares a number and the next member takes the number
  // after it, so "2." never disappears from a card where two people tied first.
  const winnerIds = week?.winnerIds ?? [];
  const share = paysThisWeek
    ? weekShareCents(payouts.weeklyPrizeCents, winnerIds.length)
    : 0;

  const ordered = week?.rows ?? [];
  let rank = 0;
  let previous: number | null = null;
  const rows: ShareRow[] = ordered.map((r, i) => {
    if (previous === null || r.correct !== previous) {
      rank = i + 1;
      previous = r.correct;
    }
    const leader = winnerIds.includes(r.userId);
    return {
      rank,
      username: r.username,
      correct: r.correct,
      decided: r.decided,
      leader,
      wonCents: leader ? share : 0,
      seasonCents: settlesSeason ? (payouts.byUser.get(r.userId)?.seasonCents ?? 0) : 0,
      bestWeekCents: settlesSeason ? (payouts.byUser.get(r.userId)?.bestWeekCents ?? 0) : 0,
    };
  });

  return {
    season,
    ref,
    complete: week?.complete ?? false,
    started: week?.started ?? false,
    totalGames: week?.totalGames ?? games.length,
    finalGames: week?.finalGames ?? 0,
    rows,
    games: games.map((g) => ({
      away: g.away.abbrev,
      home: g.home.abbrev,
      awayScore: g.awayScore,
      homeScore: g.homeScore,
      won:
        g.status === "post" && g.winnerTeamId
          ? g.winnerTeamId === g.home.id
            ? "home"
            : "away"
          : null,
      tie: g.isTie,
      final: g.status === "post",
      // The card is always rendered on paper, whatever theme the sender is in,
      // so only the light-ground colour is ever needed.
      colorHome: teamColors(g.home.color, g.home.altColor).light,
      colorAway: teamColors(g.away.color, g.away.altColor).light,
      neutral: g.neutralSite,
    })),
    seasonTop: board.season.slice(0, 3).map((s) => ({
      username: s.username,
      correct: s.correct,
    })),
  };
}

function latestPlayed(board: Scoreboard): number | null {
  const started = board.weeks.filter((w) => w.started);
  return started.length > 0 ? started[started.length - 1]!.ref.ordinal : null;
}
