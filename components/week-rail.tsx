"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export type RailWeek = {
  ordinal: number;
  short: string;
  label: string;
  /** Rendered but not linked when no games are loaded yet. */
  available: boolean;
  complete: boolean;
};

/**
 * The whole season as one dense rail, rather than a dropdown.
 *
 * A pick'em season is 22 addressable weeks — small enough to show at once, and
 * seeing them laid out is itself information: which are played, which are open,
 * where you are. It scrolls horizontally on a phone and centres the current week.
 */
export function WeekRail({
  weeks,
  current,
  hrefBase,
}: {
  weeks: RailWeek[];
  current: number;
  /** Week ordinal is appended: "/picks" → "/picks/5". */
  hrefBase: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const el = activeRef.current;
    const box = scroller.current;
    if (!el || !box) return;
    // Centre the active cell without scrolling the page itself.
    const target = el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2;
    box.scrollTo({ left: Math.max(0, target), behavior: "auto" });
  }, [current]);

  return (
    <nav aria-label="Week" className="border-b border-rule">
      <div
        ref={scroller}
        className="edge-fade -mx-4 flex gap-px overflow-x-auto px-4 pb-2 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {weeks.map((w) => {
          const active = w.ordinal === current;
          const content = (
            <>
              <span className="tabular-nums">{w.short}</span>
              {w.complete && (
                <span
                  aria-hidden
                  className={`mt-1 block h-px w-3 ${active ? "bg-ink-on/50" : "bg-n3"}`}
                />
              )}
            </>
          );

          const shared =
            "flex h-11 min-w-[2.75rem] shrink-0 flex-col items-center justify-center px-2 text-meta font-medium no-underline transition-colors duration-150";

          if (!w.available) {
            return (
              <span
                key={w.ordinal}
                title={`${w.label} — not scheduled yet`}
                className={`${shared} cursor-default text-n3`}
              >
                {content}
              </span>
            );
          }

          return (
            <Link
              key={w.ordinal}
              href={`${hrefBase}/${w.ordinal}`}
              ref={active ? activeRef : undefined}
              aria-current={active ? "page" : undefined}
              title={w.label}
              className={`${shared} ${
                active
                  ? "bg-ink font-semibold text-ink-on"
                  : "text-n1 hover:bg-sunken hover:text-ink"
              }`}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
