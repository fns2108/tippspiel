"use client";

import { useMemo, useRef, useState } from "react";
import { usePicks } from "@/components/picks-state";
import { LockIcon } from "@/components/icons";

export type RankBoardGame = {
  id: string;
  away: string;
  home: string;
  /** Team ids, so the picked side can be named from the stored pick. */
  awayId: string;
  homeId: string;
  neutralSite: boolean;
  locked: boolean;
};

/**
 * The week's points as one ordered list, most confident at the top.
 *
 * Dragging is for a mouse only. On a touch screen a drag competes with the
 * scroll gesture — you reach for the list and the page moves, or the row does
 * when you meant to scroll — so a finger gets the arrow buttons instead, at a
 * full 44px tap target. They are also what a keyboard and a screen reader use.
 *
 * Position is the only thing being edited: the numbers are dealt out from the
 * top afterwards, so they cannot end up duplicated or with a gap.
 */
export function RankBoard({ games }: { games: RankBoardGame[] }) {
  const week = usePicks();
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);

  const byRank = (ids: string[]) =>
    [...ids].sort((a, b) => {
      const ra = week.get(a)?.rank;
      const rb = week.get(b)?.rank;
      if (ra == null && rb == null) return 0;
      if (ra == null) return 1; // unranked sink to the bottom
      if (rb == null) return -1;
      return rb - ra;
    });

  const picked = games.filter((g) => week.get(g.id) !== undefined);
  const lockedGames = byRank(picked.filter((g) => g.locked).map((g) => g.id));
  const openOrder = useMemo(
    () => byRank(picked.filter((g) => !g.locked).map((g) => g.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [games, week],
  );

  const order = dragOrder ?? openOrder;
  const gameById = new Map(games.map((g) => [g.id, g]));

  // The numbers still going spare, biggest first — what the rows will be worth.
  const available = useMemo(() => {
    const spent = new Set(
      lockedGames.map((id) => week.get(id)?.rank).filter((r): r is number => r != null),
    );
    const out: number[] = [];
    for (let n = week.gameCount; n >= 1; n--) if (!spent.has(n)) out.push(n);
    return out;
  }, [lockedGames, week]);

  function moveTo(id: string, to: number) {
    const from = order.indexOf(id);
    if (from === -1 || to < 0 || to >= order.length || to === from) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, id);
    week.reorder(next);
  }

  function onPointerDown(e: React.PointerEvent<HTMLLIElement>, id: string) {
    // Touch scrolls the page; reordering there is what the arrows are for.
    if (e.pointerType === "touch") return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragId(id);
    setDragOrder(order);
  }

  function onPointerMove(e: React.PointerEvent<HTMLLIElement>) {
    if (!dragId || !dragOrder) return;
    e.preventDefault();

    const from = dragOrder.indexOf(dragId);
    let to = from;
    for (let i = 0; i < dragOrder.length; i++) {
      const el = rowRefs.current.get(dragOrder[i]!);
      if (!el) continue;
      const box = el.getBoundingClientRect();
      if (e.clientY < box.top + box.height / 2) {
        to = i;
        break;
      }
      to = i;
    }
    if (to === from) return;

    const next = [...dragOrder];
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    setDragOrder(next);
  }

  function onPointerUp() {
    if (dragId && dragOrder) {
      const changed = dragOrder.some((id, i) => openOrder[i] !== id);
      if (changed) week.reorder(dragOrder);
    }
    setDragId(null);
    setDragOrder(null);
  }

  if (picked.length === 0) return null;

  return (
    <section aria-labelledby="rank-board" className="space-y-3">
      <div className="rule-head">
        <h2 id="rank-board">Deine Punkte</h2>
      </div>

      <ol className="border-t border-rule">
        {order.map((id, i) => {
          const game = gameById.get(id)!;
          const pick = week.get(id)!;
          const dragging = dragId === id;
          return (
            <li
              key={id}
              ref={(el) => {
                if (el) rowRefs.current.set(id, el);
                else rowRefs.current.delete(id);
              }}
              onPointerDown={(e) => onPointerDown(e, id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className={`flex items-center gap-3 border-b border-rule py-1 select-none md:cursor-grab md:py-2 ${
                dragging ? "bg-panel" : ""
              } ${week.pendingFor(id) ? "opacity-60" : ""}`}
            >
              <span
                data-numeric
                className="w-9 shrink-0 text-right font-mono text-md font-semibold tabular-nums"
              >
                {available[i] ?? "—"}
              </span>

              {/* The picked side is the bold one, so the row says both which
                  game it is and who was backed without repeating a name. */}
              <span className="min-w-0 flex-1 text-sm">
                <span className={pick.teamId === game.awayId ? "font-semibold" : "text-n2"}>
                  {game.away}
                </span>
                <span className="text-n3"> {game.neutralSite ? "vs" : "@"} </span>
                <span className={pick.teamId === game.homeId ? "font-semibold" : "text-n2"}>
                  {game.home}
                </span>
              </span>

              {/* Drag is the quick way; these always work. */}
              {/* Full tap targets on a phone, back to something quiet beside a
                  mouse where dragging is the faster way. */}
              <span className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => moveTo(id, i - 1)}
                  disabled={i === 0}
                  aria-label={`${game.away} bei ${game.home} nach oben`}
                  className="flex h-13 w-13 items-center justify-center rounded-[3px] text-lg text-n1 hover:bg-sunken hover:text-ink disabled:bg-transparent disabled:text-n3 md:h-10 md:w-10 md:text-sm"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => moveTo(id, i + 1)}
                  disabled={i === order.length - 1}
                  aria-label={`${game.away} bei ${game.home} nach unten`}
                  className="flex h-13 w-13 items-center justify-center rounded-[3px] text-lg text-n1 hover:bg-sunken hover:text-ink disabled:bg-transparent disabled:text-n3 md:h-10 md:w-10 md:text-sm"
                >
                  ▼
                </button>
              </span>
            </li>
          );
        })}

        {lockedGames.map((id) => {
          const game = gameById.get(id)!;
          const pick = week.get(id)!;
          return (
            <li
              key={id}
              className="flex items-center gap-3 border-b border-rule py-2 text-n2"
              title="Angepfiffen — diese Punkte stehen fest"
            >
              <span
                data-numeric
                className="w-9 shrink-0 text-right font-mono text-md tabular-nums"
              >
                {pick.rank ?? "—"}
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <span className={pick.teamId === game.awayId ? "font-semibold" : "text-n3"}>
                  {game.away}
                </span>
                <span className="text-n3"> {game.neutralSite ? "vs" : "@"} </span>
                <span className={pick.teamId === game.homeId ? "font-semibold" : "text-n3"}>
                  {game.home}
                </span>
              </span>
              <span aria-hidden className="shrink-0 pr-2">
                <LockIcon size={12} />
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

