import { weekRef } from "@/lib/nfl/season";

/**
 * Who is owed what.
 *
 * The pool is one pot: every member's buy-in goes in, a fixed prize is set
 * aside for whoever finishes the season on top, and what remains is divided
 * equally across the payout weeks. Winning a week pays its share; tying a week
 * splits it.
 *
 * Two rules keep the arithmetic honest, and everything else follows from them:
 *
 *   1. Every amount is an integer number of cents. Nothing here is ever a
 *      float — a pot divided by 18 weeks and then by 2 tied winners is exactly
 *      the arithmetic that leaves someone owed 4.199999999999999 euro.
 *   2. Every cent that cannot be split evenly goes to the overall winner. That
 *      covers both the pot that does not divide by the number of weeks and the
 *      week that does not divide by the number of winners, so the money always
 *      adds up to what was paid in — no rounding dust, no leftover.
 *
 * A week only pays once it is complete, because that is when its winner is
 * settled. The season prize is only assigned once every payout week is done;
 * until then it is pending, and this module says so rather than guessing.
 */

export type PoolSettings = {
  buyInCents: number;
  seasonPrizeCents: number;
  includePlayoffs: boolean;
};

export const NO_POOL: PoolSettings = {
  buyInCents: 0,
  seasonPrizeCents: 0,
  includePlayoffs: false,
};

/** A buy-in of zero is how a pool says it is played for nothing. */
export function poolIsPlayedForMoney(settings: PoolSettings): boolean {
  return settings.buyInCents > 0;
}

/** Only what this module needs from a week — so it can be tested without a database. */
export type PayoutWeek = {
  ordinal: number;
  complete: boolean;
  /** May hold several ids: a tied week is shared. Empty if nobody scored. */
  winnerIds: string[];
};

export type MemberWinnings = {
  userId: string;
  /** Weeks won outright plus weeks shared. */
  weeksWon: number;
  weeklyCents: number;
  /** The overall prize, awarded only once the season's payout weeks are done. */
  seasonCents: number;
  totalCents: number;
  /** Winnings minus what they paid in. */
  netCents: number;
};

export type Payouts = {
  enabled: boolean;
  players: number;
  buyInCents: number;
  potCents: number;
  /** The ordinals that pay, in order. */
  payoutWeeks: number[];
  weeklyPrizeCents: number;
  /**
   * What the settings alone guarantee the overall winner: the configured prize
   * plus the cents the pot cannot divide across the weeks. Fixed the moment
   * the season is configured, so it is the figure the admin form can show.
   */
  seasonPrizeFloorCents: number;
  /**
   * The floor plus everything results have since rolled up — weeks nobody won,
   * and the odd cents from tied weeks. Only settled at the end of the season.
   */
  seasonPrizeCents: number;
  /** True once every payout week is complete and the overall prize is settled. */
  seasonSettled: boolean;
  /** Members tied at the top of the season table; empty until settled. */
  seasonWinnerIds: string[];
  /** Still to be won: payout weeks that have not finished. */
  pendingCents: number;
  byUser: Map<string, MemberWinnings>;
};

export function isPayoutWeek(ordinal: number, includePlayoffs: boolean): boolean {
  return includePlayoffs || !weekRef(ordinal).isPostseason;
}

/**
 * @param weeks every week with games loaded, in ordinal order. Weeks outside
 *   the payout scope are ignored rather than filtered by the caller, so the
 *   playoff toggle only has to be honoured in one place.
 * @param seasonLeaderIds members tied at the top of the season table, from the
 *   scoreboard that already ranks them.
 */
export function computePayouts(
  settings: PoolSettings,
  memberIds: string[],
  weeks: PayoutWeek[],
  seasonLeaderIds: string[],
): Payouts {
  const players = memberIds.length;
  const enabled = poolIsPlayedForMoney(settings) && players > 0;

  const byUser = new Map<string, MemberWinnings>(
    memberIds.map((userId) => [
      userId,
      {
        userId,
        weeksWon: 0,
        weeklyCents: 0,
        seasonCents: 0,
        totalCents: 0,
        netCents: enabled ? -settings.buyInCents : 0,
      },
    ]),
  );

  const payoutWeeks = weeks
    .filter((w) => isPayoutWeek(w.ordinal, settings.includePlayoffs))
    .map((w) => w.ordinal);

  const potCents = enabled ? settings.buyInCents * players : 0;

  if (!enabled || payoutWeeks.length === 0) {
    return {
      enabled: false,
      players,
      buyInCents: settings.buyInCents,
      potCents,
      payoutWeeks,
      weeklyPrizeCents: 0,
      seasonPrizeFloorCents: 0,
      seasonPrizeCents: 0,
      seasonSettled: false,
      seasonWinnerIds: [],
      pendingCents: 0,
      byUser,
    };
  }

  // The overall prize cannot exceed the pot; a misconfigured season pays
  // nothing weekly rather than going negative.
  const seasonBase = Math.min(Math.max(0, settings.seasonPrizeCents), potCents);
  const weeklyPool = potCents - seasonBase;
  const weeklyPrizeCents = Math.floor(weeklyPool / payoutWeeks.length);

  // Rule 2 starts here: whatever the weeks cannot divide is already the
  // overall winner's. This part depends only on the settings, so it is the
  // figure the admin form can promise before a single game is played.
  const seasonPrizeFloorCents = seasonBase + (weeklyPool - weeklyPrizeCents * payoutWeeks.length);
  let unsplittable = weeklyPool - weeklyPrizeCents * payoutWeeks.length;
  let pendingCents = 0;

  const inScope = weeks.filter((w) => isPayoutWeek(w.ordinal, settings.includePlayoffs));

  for (const week of inScope) {
    if (!week.complete) {
      pendingCents += weeklyPrizeCents;
      continue;
    }
    if (week.winnerIds.length === 0) {
      // A week nobody scored in has no winner; its share rolls up.
      unsplittable += weeklyPrizeCents;
      continue;
    }

    const share = Math.floor(weeklyPrizeCents / week.winnerIds.length);
    unsplittable += weeklyPrizeCents - share * week.winnerIds.length;

    for (const id of week.winnerIds) {
      const row = byUser.get(id);
      if (!row) continue;
      row.weeksWon += 1;
      row.weeklyCents += share;
    }
  }

  const seasonSettled = inScope.every((w) => w.complete);
  const seasonPrizeCents = seasonBase + unsplittable;
  const seasonWinnerIds = seasonSettled ? seasonLeaderIds.filter((id) => byUser.has(id)) : [];

  if (seasonWinnerIds.length > 0) {
    const share = Math.floor(seasonPrizeCents / seasonWinnerIds.length);
    let leftover = seasonPrizeCents - share * seasonWinnerIds.length;
    for (const id of seasonWinnerIds) {
      const row = byUser.get(id)!;
      // A tie for the season has no further tiebreak to appeal to, so the odd
      // cents go to the first of them in the table's own order.
      row.seasonCents += share + (leftover > 0 ? 1 : 0);
      if (leftover > 0) leftover -= 1;
    }
  }

  for (const row of byUser.values()) {
    row.totalCents = row.weeklyCents + row.seasonCents;
    row.netCents = row.totalCents - settings.buyInCents;
  }

  return {
    enabled: true,
    players,
    buyInCents: settings.buyInCents,
    potCents,
    payoutWeeks,
    weeklyPrizeCents,
    seasonPrizeFloorCents,
    seasonPrizeCents,
    seasonSettled,
    seasonWinnerIds,
    pendingCents,
    byUser,
  };
}

/** What one member takes from a single week, once it is settled. */
export function weekShareCents(weeklyPrizeCents: number, winnerCount: number): number {
  if (winnerCount <= 0) return 0;
  return Math.floor(weeklyPrizeCents / winnerCount);
}

const EUR = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

/** "12,50 €" — always with cents, so a column of amounts lines up. */
export function money(cents: number): string {
  return EUR.format(cents / 100);
}

/** "+12,50 €" / "−7,50 €" — the minus is a real minus sign, not a hyphen. */
export function signedMoney(cents: number): string {
  if (cents === 0) return money(0);
  return cents > 0 ? `+${money(cents)}` : `−${money(Math.abs(cents))}`;
}

/** Reads "12,50" from an admin form field. Accepts a comma or a dot. */
export function parseMoneyToCents(raw: string): number | null {
  const clean = raw.trim().replace(/[€\s]/g, "").replace(",", ".");
  if (clean === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}
