/**
 * The rules that decide whether a pick is allowed.
 *
 * Extracted from the server action so they can be tested directly: the UI
 * disables a locked button as a courtesy, but this is the actual enforcement,
 * and it is the thing that must hold when a client lies.
 */

export type PickableGame = {
  kickoff: Date;
  homeTeamId: string;
  awayTeamId: string;
};

export type PickRejection =
  | "NO_SESSION"
  | "NO_SUCH_GAME"
  | "TEAM_NOT_IN_GAME"
  | "KICKED_OFF"
  | "RANK_OUT_OF_RANGE"
  | "RANK_NEEDS_PICK"
  | "RANK_TAKEN_BY_LOCKED";

export const PICK_ERROR_MESSAGES: Record<PickRejection, string> = {
  NO_SESSION: "Du bist abgemeldet. Melde dich an und versuche es erneut.",
  NO_SUCH_GAME: "Dieses Spiel gibt es nicht mehr.",
  TEAM_NOT_IN_GAME: "Dieses Team spielt in diesem Spiel nicht mit.",
  KICKED_OFF: "Dieses Spiel hat angepfiffen — Picks sind gesperrt.",
  RANK_OUT_OF_RANGE: "Diese Punktzahl gibt es diese Woche nicht.",
  RANK_NEEDS_PICK: "Tippe erst einen Sieger, dann kannst du Punkte vergeben.",
  RANK_TAKEN_BY_LOCKED:
    "Diese Punktzahl liegt auf einem Spiel, das schon angepfiffen ist, und ist damit vergeben.",
};

/**
 * Returns the reason a pick must be refused, or null if it is allowed.
 *
 * `now` is compared against the kickoff stored in our own database, never
 * against anything the client sent, and never against the upstream game status
 * — a stalled score sync must not be able to reopen a locked game.
 */
export function rejectPick(
  game: PickableGame | undefined | null,
  teamId: string | null,
  now: Date = new Date(),
): PickRejection | null {
  if (!game) return "NO_SUCH_GAME";
  if (game.kickoff.getTime() <= now.getTime()) return "KICKED_OFF";
  // A null teamId is a clear, which only needs the lock check.
  if (teamId === null) return null;
  if (teamId !== game.homeTeamId && teamId !== game.awayTeamId) return "TEAM_NOT_IN_GAME";
  return null;
}

/** Whether a game's picks are locked and therefore visible to everyone. */
export function isLocked(kickoff: Date, now: Date = new Date()): boolean {
  return kickoff.getTime() <= now.getTime();
}

/**
 * Confidence ranks: 1..N over the week's games, each number used once.
 *
 * Assigning a rank that another game already holds swaps the two rather than
 * refusing — with every number spoken for, any other rule would leave you
 * unable to change your mind without first clearing something. The one case
 * that cannot swap is a number sitting on a game that has already kicked off:
 * that pick is frozen, so the number is genuinely spent.
 */
export function rejectRank(
  rank: number,
  gameCount: number,
  hasPick: boolean,
  heldByLockedGame: boolean,
): PickRejection | null {
  if (!Number.isInteger(rank) || rank < 1 || rank > gameCount) return "RANK_OUT_OF_RANGE";
  if (!hasPick) return "RANK_NEEDS_PICK";
  if (heldByLockedGame) return "RANK_TAKEN_BY_LOCKED";
  return null;
}

/** The ranks still free, given what is already spent on this week. */
export function availableRanks(gameCount: number, taken: Iterable<number>): number[] {
  const spent = new Set(taken);
  const out: number[] = [];
  for (let i = 1; i <= gameCount; i++) if (!spent.has(i)) out.push(i);
  return out;
}
