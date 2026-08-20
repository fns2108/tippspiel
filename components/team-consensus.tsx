"use client";

import { useMemo, useState } from "react";
import { TeamLogo } from "@/components/team-logo";
import { teamColorVars } from "@/lib/nfl/colors";

export type ConsensusRow = {
  team: {
    id: string;
    abbrev: string;
    location: string;
    name: string;
    displayName: string;
    color: string | null;
    altColor: string | null;
  };
  timesPicked: number;
  timesCorrect: number;
  decided: number;
};

type SortKey = "picked" | "best" | "worst";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "picked", label: "Most picked" },
  { key: "best", label: "Best %" },
  { key: "worst", label: "Worst %" },
];

const rate = (r: ConsensusRow) => (r.decided === 0 ? 0 : r.timesCorrect / r.decided);

/**
 * How often a team was backed, and how often that was right.
 *
 * Bar length is volume, the filled part is accuracy — the same idiom the
 * week-by-week bars use. Sorting by percentage breaks ties on volume, because
 * a team picked once and won reads as 100% and would otherwise sit above a
 * team backed twenty times.
 */
export function TeamConsensus({
  rows,
  heading,
  meta,
  subject = "the group",
  showCallouts = true,
}: {
  rows: ConsensusRow[];
  heading: string;
  meta?: string;
  /** Used in the callout copy: "the group", "Finn", "you". */
  subject?: string;
  showCallouts?: boolean;
}) {
  const [sort, setSort] = useState<SortKey>("picked");

  const settled = useMemo(() => rows.filter((r) => r.decided > 0), [rows]);

  const sorted = useMemo(() => {
    const list = [...settled];
    switch (sort) {
      case "best":
        return list.sort(
          (a, b) => rate(b) - rate(a) || b.decided - a.decided || a.team.abbrev.localeCompare(b.team.abbrev),
        );
      case "worst":
        return list.sort(
          (a, b) => rate(a) - rate(b) || b.decided - a.decided || a.team.abbrev.localeCompare(b.team.abbrev),
        );
      default:
        return list.sort(
          (a, b) => b.timesPicked - a.timesPicked || rate(b) - rate(a) || a.team.abbrev.localeCompare(b.team.abbrev),
        );
    }
  }, [settled, sort]);

  const callouts = useMemo(() => {
    if (!showCallouts) return null;
    // A minimum sample, so one lucky game does not win "most reliable".
    const eligible = settled.filter((r) => r.decided >= 3);
    if (eligible.length < 2) return null;
    const byRate = [...eligible].sort((a, b) => rate(b) - rate(a) || b.decided - a.decided);
    const best = byRate[0];
    const worst = byRate[byRate.length - 1];
    return best.team.id === worst.team.id ? null : { best, worst };
  }, [settled, showCallouts]);

  if (settled.length === 0) return null;

  const mostPicked = Math.max(...settled.map((r) => r.timesPicked));

  return (
    <section aria-labelledby={`consensus-${heading.replace(/\W+/g, "-")}`} className="space-y-3">
      <div className="rule-head">
        <h2 id={`consensus-${heading.replace(/\W+/g, "-")}`}>{heading}</h2>
        {meta && <p className="label">{meta}</p>}
      </div>

      <div className="flex items-center gap-1" role="group" aria-label="Sort teams">
        <span className="label mr-1">Sort</span>
        {SORTS.map((s) => {
          const active = s.key === sort;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              aria-pressed={active}
              className={`rounded-[3px] border px-2 py-1 text-meta transition-colors duration-150 ${
                active
                  ? "border-ink bg-ink font-medium text-ink-on"
                  : "border-rule text-n1 hover:bg-sunken hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {callouts && (
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="border border-rule px-3 py-2.5">
            <dt className="label">Most reliable</dt>
            <dd className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{callouts.best.team.displayName}</span>
              <span data-numeric className="font-mono text-meta text-n1">
                {callouts.best.timesCorrect}/{callouts.best.decided} right
              </span>
            </dd>
          </div>
          <div className="border border-rule px-3 py-2.5">
            <dt className="label">Most burned by</dt>
            <dd className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{callouts.worst.team.displayName}</span>
              <span data-numeric className="font-mono text-meta text-n1">
                {callouts.worst.timesCorrect}/{callouts.worst.decided} right
              </span>
            </dd>
          </div>
        </dl>
      )}

      <ul className="border-t border-rule">
        {sorted.map((r) => (
          <li
            key={r.team.id}
            style={teamColorVars(r.team.color, r.team.altColor)}
            className="flex items-center gap-3 border-b border-rule py-2"
          >
            <TeamLogo team={r.team} size={22} />
            <span className="w-12 shrink-0 font-mono text-meta">{r.team.abbrev}</span>

            <span className="flex min-w-0 flex-1 items-center">
              <span
                className="relative block h-2.5 bg-sunken"
                style={{ width: `${Math.max(6, (r.timesPicked / mostPicked) * 100)}%` }}
              >
                <span
                  className="team-fill absolute inset-y-0 left-0 block"
                  style={{ width: `${rate(r) * 100}%` }}
                />
              </span>
            </span>

            <span data-numeric className="shrink-0 font-mono text-meta text-n1">
              {r.timesCorrect}/{r.decided}
            </span>
            <span
              data-numeric
              className="w-11 shrink-0 text-right font-mono text-meta"
              title="Share of those picks that were correct"
            >
              {Math.round(rate(r) * 100)}%
            </span>
            <span
              data-numeric
              className="w-12 shrink-0 text-right font-mono text-meta text-n2"
              title={`Picked ${r.timesPicked} time${r.timesPicked === 1 ? "" : "s"}`}
            >
              {r.timesPicked}×
            </span>
          </li>
        ))}
      </ul>

      <p className="text-meta text-n2">
        Bar length is how often {subject} picked that team; the filled part is how often that
        pick was correct.
      </p>
    </section>
  );
}
