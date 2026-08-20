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
  | "KICKED_OFF";

export const PICK_ERROR_MESSAGES: Record<PickRejection, string> = {
  NO_SESSION: "You are signed out. Sign in and try again.",
  NO_SUCH_GAME: "That game no longer exists.",
  TEAM_NOT_IN_GAME: "That team is not playing in this game.",
  KICKED_OFF: "That game has kicked off — picks are locked.",
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
