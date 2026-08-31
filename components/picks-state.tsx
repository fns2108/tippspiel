"use client";

import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import { clearPick, clearRank, setPick, setRank } from "@/app/actions/picks";
import { swapRank, type PickState } from "@/lib/rank-swap";

/**
 * One week's picks, held above the rows.
 *
 * Ranks cannot live in the row that shows them. Assigning a number another
 * game holds swaps the two, which changes two rows at once — a row that owns
 * its own state can only ever update itself, so the displaced game keeps
 * showing the number it no longer has until the next full page load. Holding
 * the whole week here is what makes the swap visible immediately, and it is
 * also what lets every row know which numbers are already spent.
 */

type Ctx = {
  gameCount: number;
  get: (gameId: string) => PickState | undefined;
  /** Numbers currently spent anywhere in the week. */
  taken: number[];
  pendingFor: (gameId: string) => boolean;
  errorFor: (gameId: string) => string | null;
  choose: (gameId: string, teamId: string) => void;
  rankAs: (gameId: string, rank: number | null) => void;
};

const PicksContext = createContext<Ctx | null>(null);

export function usePicks(): Ctx {
  const ctx = useContext(PicksContext);
  if (!ctx) throw new Error("usePicks used outside PicksProvider");
  return ctx;
}

export function PicksProvider({
  initial,
  gameCount,
  children,
}: {
  initial: { gameId: string; teamId: string; rank: number | null }[];
  gameCount: number;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<Map<string, PickState>>(
    () => new Map(initial.map((p) => [p.gameId, { teamId: p.teamId, rank: p.rank }])),
  );
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const mark = useCallback((ids: string[], on: boolean) => {
    setBusy((prev) => {
      const next = new Set(prev);
      for (const id of ids) (on ? next.add(id) : next.delete(id));
      return next;
    });
  }, []);

  const fail = useCallback((gameId: string, message: string) => {
    setErrors((prev) => new Map(prev).set(gameId, message));
  }, []);

  const clearError = useCallback((gameId: string) => {
    setErrors((prev) => {
      if (!prev.has(gameId)) return prev;
      const next = new Map(prev);
      next.delete(gameId);
      return next;
    });
  }, []);

  const choose = useCallback(
    (gameId: string, teamId: string) => {
      const before = state.get(gameId);
      // Tapping the current pick clears it, so a game can be left blank.
      const clearing = before?.teamId === teamId;

      setState((prev) => {
        const next = new Map(prev);
        if (clearing) next.delete(gameId);
        // The rank belongs to the game, so switching sides keeps it.
        else next.set(gameId, { teamId, rank: before?.rank ?? null });
        return next;
      });
      clearError(gameId);
      mark([gameId], true);

      startTransition(async () => {
        const result = clearing ? await clearPick(gameId) : await setPick(gameId, teamId);
        mark([gameId], false);
        if (!result.ok) {
          setState((prev) => {
            const next = new Map(prev);
            if (before) next.set(gameId, before);
            else next.delete(gameId);
            return next;
          });
          fail(gameId, result.error);
        }
      });
    },
    [state, clearError, fail, mark],
  );

  const rankAs = useCallback(
    (gameId: string, rank: number | null) => {
      const before = new Map(state);
      if (!state.has(gameId)) return;

      const { next, displaced } = swapRank(state, gameId, rank);
      setState(next);

      const touched = displaced ? [gameId, displaced] : [gameId];
      clearError(gameId);
      mark(touched, true);

      startTransition(async () => {
        const result = rank === null ? await clearRank(gameId) : await setRank(gameId, rank);
        mark(touched, false);
        if (!result.ok) {
          setState(before);
          fail(gameId, result.error);
        }
      });
    },
    [state, clearError, fail, mark],
  );

  const taken = useMemo(
    () =>
      [...state.values()]
        .map((p) => p.rank)
        .filter((r): r is number => r !== null)
        .sort((a, b) => a - b),
    [state],
  );

  const value = useMemo<Ctx>(
    () => ({
      gameCount,
      get: (gameId) => state.get(gameId),
      taken,
      pendingFor: (gameId) => busy.has(gameId),
      errorFor: (gameId) => errors.get(gameId) ?? null,
      choose,
      rankAs,
    }),
    [gameCount, state, taken, busy, errors, choose, rankAs],
  );

  return <PicksContext.Provider value={value}>{children}</PicksContext.Provider>;
}

export type { PickState };
