import type { WeekStanding } from "@/lib/queries";

export type AdjustmentSum = { userId: string; ordinal: number; points: number };

/**
 * Adds hand corrections into the per-week standings, in place.
 *
 * Runs before anything is ranked, so a weekly winner, a season total or a
 * best-week prize is only ever decided on corrected numbers. A correction for a
 * member who picked nothing that week creates their row rather than being lost,
 * and one for an account that no longer exists is dropped.
 */
export function applyAdjustments(
  perWeek: Map<number, Map<string, WeekStanding>>,
  adjustments: AdjustmentSum[],
  nameById: Map<string, string>,
): void {
  for (const a of adjustments) {
    const username = nameById.get(a.userId);
    if (username === undefined) continue;

    let byUser = perWeek.get(a.ordinal);
    if (!byUser) {
      byUser = new Map();
      perWeek.set(a.ordinal, byUser);
    }

    const row = byUser.get(a.userId) ?? {
      userId: a.userId,
      username,
      points: 0,
      adjustment: 0,
      correct: 0,
      picked: 0,
      decided: 0,
    };
    row.points += a.points;
    row.adjustment += a.points;
    byUser.set(a.userId, row);
  }
}
