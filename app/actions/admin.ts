"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { games, inviteKeys } from "@/lib/db/schema";
import { syncWeekIfStale } from "@/lib/espn/sync";
import { generateInviteCode } from "@/lib/invite";
import { currentSeason, isValidOrdinal } from "@/lib/nfl/season";

export type AdminState = { error: string | null; notice: string | null };

export async function createInviteKeyAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const label = String(formData.get("label") ?? "").trim() || null;
  const maxUses = Number(formData.get("maxUses") ?? 1);
  const expiresInDays = Number(formData.get("expiresInDays") ?? 0);

  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100) {
    return { error: "Uses must be a whole number between 1 and 100.", notice: null };
  }

  const expiresAt =
    Number.isInteger(expiresInDays) && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 86_400_000)
      : null;

  const code = generateInviteCode();
  await db.insert(inviteKeys).values({ code, label, maxUses, expiresAt });

  revalidatePath("/admin");
  return { error: null, notice: `Created ${code}` };
}

export async function revokeInviteKeyAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const code = String(formData.get("code") ?? "");
  if (code) {
    await db.update(inviteKeys).set({ revokedAt: new Date() }).where(eq(inviteKeys.code, code));
  }
  revalidatePath("/admin");
}

export async function resyncWeekAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const ordinal = Number(formData.get("ordinal") ?? 0);
  if (isValidOrdinal(ordinal)) {
    await syncWeekIfStale(currentSeason(), ordinal, { force: true });
  }
  revalidatePath("/admin");
  revalidatePath("/picks");
  revalidatePath("/standings");
}

/**
 * Corrects a result by hand when the upstream feed gets one wrong.
 *
 * Sets `manualOverride`, which makes the sync stop touching that row — so the
 * correction cannot be silently undone by the next fetch. Standings recompute
 * from this on the next read, with no stored totals to go stale.
 */
export async function overrideResultAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const gameId = String(formData.get("gameId") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  if (!gameId) return;

  if (outcome === "release") {
    await db
      .update(games)
      .set({ manualOverride: false, updatedAt: new Date() })
      .where(eq(games.id, gameId));
  } else {
    const [game] = await db
      .select({ home: games.homeTeamId, away: games.awayTeamId })
      .from(games)
      .where(eq(games.id, gameId));
    if (!game) return;

    const isTie = outcome === "tie";
    const winnerTeamId =
      outcome === game.home ? game.home : outcome === game.away ? game.away : null;
    if (!isTie && winnerTeamId === null) return;

    await db
      .update(games)
      .set({
        status: "post",
        statusDetail: "Final (corrected)",
        winnerTeamId: isTie ? null : winnerTeamId,
        isTie,
        manualOverride: true,
        updatedAt: new Date(),
      })
      .where(eq(games.id, gameId));
  }

  revalidatePath("/admin");
  revalidatePath("/standings");
}
