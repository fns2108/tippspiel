"use server";

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { games, inviteKeys, pointAdjustments, users } from "@/lib/db/schema";
import { syncWeekIfStale } from "@/lib/espn/sync";
import { generateInviteCode } from "@/lib/invite";
import { currentSeason, isValidOrdinal } from "@/lib/nfl/season";
import { money, parseMoneyToCents } from "@/lib/payouts";
import { savePoolSettings } from "@/lib/pool";
import { sendTestReminder } from "@/lib/reminders";

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

  const pot = parseMoneyToCents(String(formData.get("pot") ?? ""));
  const seasonPrize = parseMoneyToCents(String(formData.get("seasonPrize") ?? ""));
  const bestWeek = parseMoneyToCents(String(formData.get("bestWeekPrize") ?? ""));
  const includePlayoffs = formData.get("includePlayoffs") === "on";

  if (pot === null) {
    return { error: "Der Einsatz muss ein Betrag sein, z. B. 160 oder 152,50.", notice: null };
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

  if (seasonPrize + bestWeek > pot) {
    return {
      error:
        `Saisonpreis und beste Woche zusammen (${money(seasonPrize + bestWeek)}) sind größer ` +
        `als der Einsatz (${money(pot)}).`,
      notice: null,
    };
  }

  await savePoolSettings(season, {
    potCents: pot,
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
      pot === 0
        ? "Auszahlungen sind aus. Es taucht nirgends Geld auf."
        : `Gespeichert: ${money(pot)} im Topf, ${money(seasonPrize)} für die Gesamtwertung, ` +
          `${money(bestWeek)} für die beste Woche.`,
  };
}

/** Sends the signed-in admin a test notification, bypassing horizon and stamp. */
export async function sendTestReminderAction(
  _prev: AdminState,
  _formData: FormData,
): Promise<AdminState> {
  const admin = await requireAdmin();

  /**
   * Nothing below is allowed to throw out of this action. A server action that
   * throws leaves `useActionState` holding its previous state, so the form
   * renders no message at all and the button looks broken — which is exactly
   * how a broken notification setup used to present.
   */
  let report;
  try {
    report = await sendTestReminder(admin.id);
  } catch (err) {
    console.error("[reminder-test]", err);
    return { error: `Unerwarteter Fehler: ${(err as Error).message}`, notice: null };
  }

  if (!report.configured) {
    return { error: report.reason ?? "Erinnerungen sind nicht eingerichtet.", notice: null };
  }
  if (report.sent === 0) {
    return {
      error: `Versand fehlgeschlagen${report.errors.length > 0 ? `: ${report.errors.join(", ")}` : "."}`,
      notice: null,
    };
  }

  return { error: null, notice: "Test an dein ntfy-Topic geschickt." };
}

/** Every page that shows a points total. */
function scoresChanged() {
  revalidatePath("/admin");
  revalidatePath("/standings");
  revalidatePath("/week/[season]/[ordinal]", "page");
  revalidatePath("/u/[username]", "page");
  revalidatePath("/share/[[...ordinal]]", "page");
}

/**
 * Adds a hand correction to one member's points for one week.
 *
 * Accepts "+3", "3", "-2" and the typographic "−2", because on a phone the
 * number keyboard and autocorrect disagree about which minus you meant.
 */
export async function addPointAdjustmentAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const ordinal = Number(formData.get("ordinal") ?? 0);
  const rawPoints = String(formData.get("points") ?? "").trim().replace("−", "-");
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;

  if (!/^[+-]?\d+$/.test(rawPoints) || Number(rawPoints) === 0) {
    return { error: "Punkte müssen eine ganze Zahl ungleich 0 sein, z. B. +3 oder -2.", notice: null };
  }
  const points = Number(rawPoints);
  if (Math.abs(points) > 500) {
    return { error: "Eine Korrektur darf höchstens 500 Punkte groß sein.", notice: null };
  }
  if (!isValidOrdinal(ordinal)) {
    return { error: "Wähl eine Woche aus.", notice: null };
  }

  const [member] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId));
  if (!member) return { error: "Wähl ein Mitglied aus.", notice: null };

  await db.insert(pointAdjustments).values({
    id: randomUUID(),
    userId,
    season: currentSeason(),
    ordinal,
    points,
    note,
  });

  scoresChanged();
  return {
    error: null,
    notice: `${member.username}: ${points > 0 ? "+" : "−"}${Math.abs(points)} Punkte gespeichert.`,
  };
}

/** Removes a correction; the week's points go back to what the picks earned. */
export async function deletePointAdjustmentAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (id) await db.delete(pointAdjustments).where(eq(pointAdjustments.id, id));
  scoresChanged();
}

