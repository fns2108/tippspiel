/**
 * The optimistic half of a rank change: what the week looks like the instant a
 * number is chosen, before the server has answered.
 *
 * Kept out of the component so it can be tested directly. This is the part that
 * was wrong — assigning a taken number left the displaced row still showing it
 * — and a defect whose whole symptom is "the other row did not move" needs a
 * test that watches both rows.
 *
 * It mirrors what `lib/ranks.ts` does in Postgres. The two are deliberately
 * separate: this one has to be synchronous and run in the browser.
 */

export type PickState = { teamId: string; rank: number | null };

export function swapRank(
  state: Map<string, PickState>,
  gameId: string,
  rank: number | null,
): { next: Map<string, PickState>; displaced: string | null } {
  const mine = state.get(gameId);
  if (!mine) return { next: state, displaced: null };

  const displaced =
    rank === null
      ? null
      : ([...state.entries()].find(([id, p]) => id !== gameId && p.rank === rank)?.[0] ?? null);

  const next = new Map(state);
  next.set(gameId, { ...mine, rank });
  // Whoever held the number takes this game's, which may be none — then it
  // simply comes back unranked.
  if (displaced) next.set(displaced, { ...state.get(displaced)!, rank: mine.rank });

  return { next, displaced };
}
