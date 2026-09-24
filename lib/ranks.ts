import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { games, picks } from "@/lib/db/schema";
import { PICK_ERROR_MESSAGES, rejectRank } from "@/lib/pick-rules";

export type RankResult = { ok: true } | { ok: false; error: string };

type WeekKey = { season: number; seasonType: number; week: number };

/**
 * Moves a confidence rank onto a game, swapping with whichever game already
 * holds it.
 *
 * Split out of the server action so it can be exercised directly against a
 * database — the swap is three dependent writes and a read, and "it looks
 * right" is not the same as having watched it run.
 *
 * Runs inside one transaction: the "each number once per member per week" rule
 * spans rows in `games` and so cannot be a column constraint, and two tabs on
 * the same account would otherwise be able to leave a member holding the same
 * number twice.
 */
export async function applyRank(
  userId: string,
  gameId: string,
  rank: number,
  weekKey: WeekKey,
  now: Date = new Date(),
): Promise<RankResult> {
  return db.transaction(async (tx) => {
    const week = await tx
      .select({
        id: games.id,
        kickoff: games.kickoff,
        pickedRank: picks.rank,
        pickedBy: picks.userId,
      })
      .from(games)
      .leftJoin(picks, and(eq(picks.gameId, games.id), eq(picks.userId, userId)))
      .where(
        and(
          eq(games.season, weekKey.season),
          eq(games.seasonType, weekKey.seasonType),
          eq(games.week, weekKey.week),
        ),
      );

    const mine = week.filter((r) => r.pickedBy === userId);
    const holder = mine.find((r) => r.pickedRank === rank && r.id !== gameId);

    const bad = rejectRank(
      rank,
      week.length,
      mine.some((r) => r.id === gameId),
      holder !== undefined && holder.kickoff.getTime() <= now.getTime(),
    );
    if (bad) return { ok: false as const, error: PICK_ERROR_MESSAGES[bad] };

    const previous = mine.find((r) => r.id === gameId)?.pickedRank ?? null;

    // Park the holder on null first: the two games would otherwise both hold
    // the same number between the second and third statement.
    if (holder) {
      await tx
        .update(picks)
        .set({ rank: null, updatedAt: now })
        .where(and(eq(picks.userId, userId), eq(picks.gameId, holder.id)));
    }

    await tx
      .update(picks)
      .set({ rank, updatedAt: now })
      .where(and(eq(picks.userId, userId), eq(picks.gameId, gameId)));

    // The displaced game takes whatever this one was carrying, which may be
    // nothing — then it simply comes back unranked.
    if (holder) {
      await tx
        .update(picks)
        .set({ rank: previous, updatedAt: now })
        .where(and(eq(picks.userId, userId), eq(picks.gameId, holder.id)));
    }

    return { ok: true as const };
  });
}

export async function removeRank(userId: string, gameId: string): Promise<void> {
  await db
    .update(picks)
    .set({ rank: null, updatedAt: new Date() })
    .where(and(eq(picks.userId, userId), eq(picks.gameId, gameId)));
}

/**
 * Rewrites a whole week's order in one go, for drag and drop.
 *
 * `orderedGameIds` is the open, picked games from most confident to least. The
 * numbers handed out are whatever 1..N the locked games have not already spent,
 * so a game that has kicked off keeps the points it was picked with and the
 * rest slot in around it. Everything is cleared before anything is set, because
 * the week passes through states where two games would otherwise hold the same
 * number.
 */
export async function reorderRanks(
  userId: string,
  orderedGameIds: string[],
  weekKey: WeekKey,
  now: Date = new Date(),
): Promise<RankResult> {
  return db.transaction(async (tx) => {
    const week = await tx
      .select({
        id: games.id,
        kickoff: games.kickoff,
        pickedRank: picks.rank,
        pickedBy: picks.userId,
      })
      .from(games)
      .leftJoin(picks, and(eq(picks.gameId, games.id), eq(picks.userId, userId)))
      .where(
        and(
          eq(games.season, weekKey.season),
          eq(games.seasonType, weekKey.seasonType),
          eq(games.week, weekKey.week),
        ),
      );

    const open = new Map(
      week
        .filter((r) => r.pickedBy === userId && r.kickoff.getTime() > now.getTime())
        .map((r) => [r.id, r]),
    );

    // Only games this member has actually picked and can still change, each at
    // most once — a reordered list from a stale tab must not invent rows.
    const seen = new Set<string>();
    const target = orderedGameIds.filter((id) => {
      if (!open.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    if (target.length === 0) return { ok: true as const };

    const spent = new Set(
      week
        .filter((r) => r.pickedBy === userId && r.kickoff.getTime() <= now.getTime())
        .map((r) => r.pickedRank)
        .filter((r): r is number => r !== null),
    );

    const available: number[] = [];
    for (let n = week.length; n >= 1; n--) if (!spent.has(n)) available.push(n);

    await tx
      .update(picks)
      .set({ rank: null, updatedAt: now })
      .where(and(eq(picks.userId, userId), inArray(picks.gameId, target)));

    for (const [i, gameId] of target.entries()) {
      const rank = available[i];
      if (rank === undefined) break;
      await tx
        .update(picks)
        .set({ rank, updatedAt: now })
        .where(and(eq(picks.userId, userId), eq(picks.gameId, gameId)));
    }

    return { ok: true as const };
  });
}

