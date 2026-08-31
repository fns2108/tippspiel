"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { games, picks } from "@/lib/db/schema";
import { PICK_ERROR_MESSAGES, rejectPick } from "@/lib/pick-rules";
import { applyRank, removeRank } from "@/lib/ranks";

export type PickResult = { ok: true } | { ok: false; error: string };

async function loadGame(gameId: string) {
  const [game] = await db
    .select({
      kickoff: games.kickoff,
      homeTeamId: games.homeTeamId,
      awayTeamId: games.awayTeamId,
      season: games.season,
      seasonType: games.seasonType,
      week: games.week,
    })
    .from(games)
    .where(eq(games.id, gameId));
  return game;
}

function touched() {
  /**
   * The picks page is `/picks/[[...ordinal]]`, so a literal "/picks" only ever
   * matches the bare url — a member sitting on /picks/5 would keep being served
   * the cached payload for up to `staleTimes.dynamic`. Revalidating the route
   * pattern covers every week at once.
   */
  revalidatePath("/picks/[[...ordinal]]", "page");
  revalidatePath("/standings");
  revalidatePath("/week/[season]/[ordinal]", "page");
}

/**
 * Records one pick.
 *
 * The lock lives here, not in the UI. A disabled button is a courtesy; this is
 * the rule, and it compares the kickoff stored in our own database against the
 * server clock — so it holds whatever the client believes and whether or not
 * the score sync has run.
 */
export async function setPick(gameId: string, teamId: string): Promise<PickResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: PICK_ERROR_MESSAGES.NO_SESSION };

  const rejection = rejectPick(await loadGame(gameId), teamId);
  if (rejection) return { ok: false, error: PICK_ERROR_MESSAGES[rejection] };

  await db
    .insert(picks)
    .values({ userId: user.id, gameId, teamId })
    .onConflictDoUpdate({
      target: [picks.userId, picks.gameId],
      // The rank belongs to the game, not to the side taken, so changing your
      // mind about the winner keeps the confidence you had in it.
      set: { teamId, updatedAt: new Date() },
    });

  touched();
  return { ok: true };
}

/** Clears a pick, so a member can genuinely leave a game blank. */
export async function clearPick(gameId: string): Promise<PickResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: PICK_ERROR_MESSAGES.NO_SESSION };

  const rejection = rejectPick(await loadGame(gameId), null);
  if (rejection) return { ok: false, error: PICK_ERROR_MESSAGES[rejection] };

  await db.delete(picks).where(and(eq(picks.userId, user.id), eq(picks.gameId, gameId)));

  touched();
  return { ok: true };
}

/**
 * Assigns a confidence rank, swapping with whichever game already holds it.
 *
 * The whole week is read and written inside one transaction: the "each number
 * once" rule spans rows in `games` and so cannot be a column constraint, and
 * two tabs open on the same account would otherwise be able to leave a member
 * holding the same number twice.
 */
export async function setRank(gameId: string, rank: number): Promise<PickResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: PICK_ERROR_MESSAGES.NO_SESSION };

  const game = await loadGame(gameId);
  const rejection = rejectPick(game, null);
  if (rejection) return { ok: false, error: PICK_ERROR_MESSAGES[rejection] };

  const result = await applyRank(user.id, gameId, rank, {
    season: game!.season,
    seasonType: game!.seasonType,
    week: game!.week,
  });
  if (result.ok) touched();
  return result;
}

/** Takes the number off a game, putting it back in circulation. */
export async function clearRank(gameId: string): Promise<PickResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: PICK_ERROR_MESSAGES.NO_SESSION };

  const rejection = rejectPick(await loadGame(gameId), null);
  if (rejection) return { ok: false, error: PICK_ERROR_MESSAGES[rejection] };

  await removeRank(user.id, gameId);

  touched();
  return { ok: true };
}
