import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { poolSettings } from "@/lib/db/schema";
import { NO_POOL, computePayouts, type PoolSettings, type Payouts } from "@/lib/payouts";
import type { Scoreboard } from "@/lib/queries";

/** The stored settings for a season, or a pool played for nothing. */
export async function getPoolSettings(season: number): Promise<PoolSettings> {
  const [row] = await db
    .select({
      buyInCents: poolSettings.buyInCents,
      seasonPrizeCents: poolSettings.seasonPrizeCents,
      bestWeekPrizeCents: poolSettings.bestWeekPrizeCents,
      includePlayoffs: poolSettings.includePlayoffs,
    })
    .from(poolSettings)
    .where(eq(poolSettings.season, season));

  return row ?? NO_POOL;
}

export async function savePoolSettings(
  season: number,
  settings: PoolSettings,
): Promise<void> {
  await db
    .insert(poolSettings)
    .values({ season, ...settings })
    .onConflictDoUpdate({
      target: poolSettings.season,
      set: { ...settings, updatedAt: new Date() },
    });
}

/**
 * Everyone still tied at the top of the season table.
 *
 * A season nobody has scored in has no leader — otherwise the whole pool would
 * "lead" on zero and the overall prize would be split between all of them.
 */
function seasonLeaders(board: Scoreboard): string[] {
  const top = board.season[0]?.correct ?? 0;
  if (top === 0) return [];
  return board.season.filter((s) => s.correct === top).map((s) => s.userId);
}

/** Bridges the scoreboard the pages already load into the payout arithmetic. */
export function payoutsFromBoard(settings: PoolSettings, board: Scoreboard): Payouts {
  return computePayouts(
    settings,
    board.members.map((m) => m.id),
    board.weeks.map((w) => ({
      ordinal: w.ref.ordinal,
      complete: w.complete,
      winnerIds: w.winnerIds,
      scores: w.rows.map((r) => ({ userId: r.userId, correct: r.correct })),
    })),
    seasonLeaders(board),
  );
}
