"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { games, picks } from "@/lib/db/schema";
import { PICK_ERROR_MESSAGES, rejectPick } from "@/lib/pick-rules";

export type PickResult = { ok: true } | { ok: false; error: string };

async function loadGame(gameId: string) {
  const [game] = await db
    .select({
      kickoff: games.kickoff,
      homeTeamId: games.homeTeamId,
      awayTeamId: games.awayTeamId,
    })
    .from(games)
    .where(eq(games.id, gameId));
  return game;
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
      set: { teamId, updatedAt: new Date() },
    });

  revalidatePath("/picks");
  revalidatePath("/standings");
  return { ok: true };
}

/** Clears a pick, so a member can genuinely leave a game blank. */
export async function clearPick(gameId: string): Promise<PickResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: PICK_ERROR_MESSAGES.NO_SESSION };

  const rejection = rejectPick(await loadGame(gameId), null);
  if (rejection) return { ok: false, error: PICK_ERROR_MESSAGES[rejection] };

  await db.delete(picks).where(and(eq(picks.userId, user.id), eq(picks.gameId, gameId)));

  revalidatePath("/picks");
  revalidatePath("/standings");
  return { ok: true };
}
