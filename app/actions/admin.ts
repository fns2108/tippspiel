"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { games, inviteKeys, users } from "@/lib/db/schema";
import { syncWeekIfStale } from "@/lib/espn/sync";
import { generateInviteCode } from "@/lib/invite";
import { currentSeason, isValidOrdinal } from "@/lib/nfl/season";
import { money, parseMoneyToCents } from "@/lib/payouts";
import { savePoolSettings } from "@/lib/pool";

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
    return { error: "Nutzungen müssen eine ganze Zahl zwischen 1 und 100 sein.", notice: null };
  }

  const expiresAt =
    Number.isInteger(expiresInDays) && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 86_400_000)
      : null;

  const code = generateInviteCode();
  await db.insert(inviteKeys).values({ code, label, maxUses, expiresAt });

  revalidatePath("/admin");
  return { error: null, notice: `${code} erstellt` };
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
        statusDetail: "Endstand (korrigiert)",
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

/**
 * Sets what the season costs and what it pays.
 *
 * Validated here rather than only in the browser: these three numbers decide
 * who is owed money, so a hand-rolled POST must not be able to put the pool in
 * a state the arithmetic cannot honour.
 */
export async function savePayoutSettingsAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const buyIn = parseMoneyToCents(String(formData.get("buyIn") ?? ""));
  const seasonPrize = parseMoneyToCents(String(formData.get("seasonPrize") ?? ""));
  const bestWeek = parseMoneyToCents(String(formData.get("bestWeekPrize") ?? ""));
  const includePlayoffs = formData.get("includePlayoffs") === "on";

  if (buyIn === null) {
    return { error: "Der Einsatz muss ein Betrag sein, z. B. 20 oder 12,50.", notice: null };
  }
  if (seasonPrize === null) {
    return { error: "Der Saisonpreis muss ein Betrag sein, z. B. 50 oder 12,50.", notice: null };
  }
  if (bestWeek === null) {
    return {
      error: "Der Preis für die beste Woche muss ein Betrag sein, z. B. 20 oder 12,50.",
      notice: null,
    };
  }

  const season = currentSeason();
  const [{ players }] = await db
    .select({ players: sql<number>`count(*)::int` })
    .from(users);

  const pot = buyIn * players;
  if (seasonPrize + bestWeek > pot) {
    return {
      error:
        `Saisonpreis und beste Woche zusammen (${money(seasonPrize + bestWeek)}) sind größer ` +
        `als der Topf (${money(pot)} bei ${players} ${players === 1 ? "Mitglied" : "Mitgliedern"}).`,
      notice: null,
    };
  }

  await savePoolSettings(season, {
    buyInCents: buyIn,
    seasonPrizeCents: seasonPrize,
    bestWeekPrizeCents: bestWeek,
    includePlayoffs,
  });

  revalidatePath("/admin");
  revalidatePath("/standings");
  revalidatePath("/share");

  return {
    error: null,
    notice:
      buyIn === 0
        ? "Auszahlungen sind aus. Es taucht nirgends Geld auf."
        : `Gespeichert: ${money(buyIn)} pro Person, ${money(seasonPrize)} für die Gesamtwertung, ` +
          `${money(bestWeek)} für die beste Woche.`,
  };
}
