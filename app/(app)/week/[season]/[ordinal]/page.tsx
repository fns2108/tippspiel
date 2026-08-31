import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckIcon, CrossIcon, LockIcon } from "@/components/icons";
import { LiveRefresh } from "@/components/live-refresh";
import { LocalTime } from "@/components/local-time";
import { TeamLogo } from "@/components/team-logo";
import { WeekRail } from "@/components/week-rail";
import { requireUser } from "@/lib/auth";
import { SERVER_TZ, formatTime, nflDayShort } from "@/lib/format";
import { teamColorVars } from "@/lib/nfl/colors";
import { currentSeason, isValidOrdinal, weekRef } from "@/lib/nfl/season";
import { getScoreboard } from "@/lib/queries";
import { buildWeekRail, loadWeekView } from "@/lib/week-view";

export const dynamic = "force-dynamic";

type Params = { season: string; ordinal: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { ordinal } = await params;
  const n = Number(ordinal);
  return { title: isValidOrdinal(n) ? `${weekRef(n).label} Grid` : "Grid" };
}

export default async function GridPage({ params }: { params: Promise<Params> }) {
  const user = await requireUser();
  const { season: seasonParam, ordinal: ordinalParam } = await params;

  const season = Number(seasonParam);
  const ordinal = Number(ordinalParam);
  if (!Number.isInteger(season) || !isValidOrdinal(ordinal)) notFound();

  const [view, rail, board] = await Promise.all([
    loadWeekView(season, ordinal, user.id),
    buildWeekRail(season, ordinal),
    getScoreboard(season),
  ]);

  const week = board.weeks.find((w) => w.ref.ordinal === ordinal);
  const members = board.members;
  const allGames = view.groups.flatMap((g) => g.games);
  const revealed = allGames.filter((g) => g.locked);

  const scoreByUser = new Map(week?.rows.map((r) => [r.userId, r]) ?? []);

  return (
    <div className="space-y-5">
      <header className="rule-head">
        <div className="flex items-baseline gap-3">
          <h1>{view.ref.label}</h1>
          <LiveRefresh active={view.liveCount > 0} />
        </div>
        <p className="label" data-numeric>
          {revealed.length}/{allGames.length} sichtbar
        </p>
      </header>

      <WeekRail weeks={rail} current={ordinal} hrefBase={`/week/${season}`} />

      {allGames.length === 0 ? (
        <p className="border border-rule bg-panel px-4 py-8 text-center text-sm text-n1">
          Für {view.ref.label} sind noch keine Spiele angesetzt.
        </p>
      ) : members.length === 0 ? (
        <p className="border border-rule bg-panel px-4 py-8 text-center text-sm text-n1">
          Es ist noch niemand dabei.
        </p>
      ) : (
        <>
          {revealed.length === 0 && (
            <p className="flex items-center gap-2 border border-rule bg-panel px-3 py-2.5 text-sm text-n1">
              <span aria-hidden>
                <LockIcon />
              </span>
              Es wurde noch kein Spiel angepfiffen. Die Spalten füllen sich, wenn das jeweilige
              Spiel startet.
            </p>
          )}

          {/* Games run down the page and members across it: vertical scroll is
              free on a phone, and one row reads as "who took this game". */}
          <div className="edge-fade -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <table className="w-full min-w-max border-collapse text-sm">
              <caption className="sr-only">
                Die Picks aller Mitglieder für jedes Spiel in {view.ref.label}, mit den Punkten,
                die darauf gesetzt sind. Picks erscheinen, sobald ein Spiel angepfiffen ist.
              </caption>
              <thead>
                <tr className="border-b border-ink">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 bg-paper py-2 pr-3 text-left align-bottom"
                  >
                    <span className="label">Spiel</span>
                  </th>
                  {members.map((m) => (
                    <th key={m.id} scope="col" className="px-1.5 py-2 align-bottom">
                      <Link
                        href={`/u/${encodeURIComponent(m.username)}`}
                        title={m.username}
                        className={`block max-w-[5.5rem] truncate text-meta no-underline ${
                          m.id === user.id ? "font-semibold text-ink" : "text-n1 hover:text-ink"
                        }`}
                      >
                        {m.username}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {allGames.map((g) => {
                  const picks = view.pickedByGame.get(g.id) ?? [];
                  const byUser = new Map(picks.map((p) => [p.userId, p]));
                  const final = g.status === "post";

                  return (
                    <tr key={g.id} className="border-b border-rule">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-paper py-1.5 pr-3 text-left font-normal"
                      >
                        <span className="flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <TeamLogo team={g.away} size={18} />
                            <span
                              className={`font-mono text-meta ${
                                final && g.winnerTeamId === g.away.id
                                  ? "font-bold"
                                  : final
                                    ? "text-n2"
                                    : ""
                              }`}
                            >
                              {g.away.abbrev}
                            </span>
                          </span>
                          <span aria-hidden className="text-n3">
                            {g.neutralSite ? "vs" : "@"}
                          </span>
                          <span className="flex items-center gap-1">
                            <TeamLogo team={g.home} size={18} />
                            <span
                              className={`font-mono text-meta ${
                                final && g.winnerTeamId === g.home.id
                                  ? "font-bold"
                                  : final
                                    ? "text-n2"
                                    : ""
                              }`}
                            >
                              {g.home.abbrev}
                            </span>
                          </span>
                          <span className="ml-1 shrink-0 font-mono text-micro tabular-nums text-n2">
                            {g.status === "pre" ? (
                              <>
                                {nflDayShort(g.kickoff)}{" "}
                                <LocalTime
                                  iso={g.kickoff.toISOString()}
                                  fallback={formatTime(g.kickoff, SERVER_TZ)}
                                />
                              </>
                            ) : (
                              <span className={g.status === "in" ? "text-live" : ""}>
                                {g.awayScore}–{g.homeScore}
                              </span>
                            )}
                          </span>
                        </span>
                      </th>

                      {members.map((m) => {
                        const entry = byUser.get(m.id);
                        const teamId = entry?.teamId;
                        if (!g.locked) {
                          return (
                            <td
                              key={m.id}
                              className="px-1.5 py-1.5 text-center text-n3"
                              title="Bis zum Kickoff verborgen"
                            >
                              <span aria-label="Bis zum Kickoff verborgen">·</span>
                            </td>
                          );
                        }
                        if (!teamId) {
                          return (
                            <td
                              key={m.id}
                              className="px-1.5 py-1.5 text-center font-mono text-meta text-n3"
                              title={`${m.username} hat dieses Spiel nicht getippt`}
                            >
                              —
                            </td>
                          );
                        }
                        const team = teamId === g.home.id ? g.home : g.away;
                        const correct = final && g.winnerTeamId === teamId;
                        const wrong = final && g.winnerTeamId !== null && !correct;

                        return (
                          <td key={m.id} className="px-1.5 py-1.5 text-center">
                            <span
                              style={teamColorVars(team.color, team.altColor)}
                              className={`inline-flex items-center gap-1 font-mono text-meta ${
                                wrong ? "text-n2" : "team-text"
                              }`}
                              title={`${m.username}: ${team.displayName}${
                                entry?.rank == null ? " (ohne Punkte)" : ` für ${entry.rank} Punkte`
                              }`}
                            >
                              {final && (
                                <span aria-hidden className={correct ? "text-correct" : "text-wrong"}>
                                  {correct ? <CheckIcon size={11} /> : <CrossIcon size={11} />}
                                </span>
                              )}
                              {team.abbrev}
                              {/* What the pick was worth rides with it — the grid
                                  is unreadable otherwise, because a column of
                                  abbreviations no longer explains the total. */}
                              <span className={`tabular-nums ${wrong ? "text-n3" : "text-n2"}`}>
                                {entry?.rank ?? "·"}
                              </span>
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="border-t-2 border-ink">
                  <th scope="row" className="sticky left-0 z-10 bg-paper py-2 pr-3 text-left">
                    <span className="label">
                      {week?.complete ? "Endstand" : "Punkte bisher"}
                    </span>
                  </th>
                  {members.map((m) => {
                    const row = scoreByUser.get(m.id);
                    const isWinner = week?.winnerIds.includes(m.id) ?? false;
                    return (
                      <td key={m.id} className="px-1.5 py-2 text-center">
                        <span
                          data-numeric
                          className={`font-mono text-sm ${
                            isWinner ? "font-bold text-ink" : "text-n1"
                          }`}
                          title={
                            isWinner
                              ? (week?.winnerIds.length ?? 0) > 1
                                ? "Woche geteilt"
                                : "Woche gewonnen"
                              : undefined
                          }
                        >
                          {row?.points ?? 0}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>

          {week?.complete && week.winnerIds.length > 0 && (
            <p className="text-sm text-n1">
              <span className="label mr-2">
                {week.winnerIds.length > 1 ? "Woche geteilt" : "Wochensieger"}
              </span>
              <span className="font-medium text-ink">
                {week.winnerIds
                  .map((id) => members.find((m) => m.id === id)?.username ?? "—")
                  .join(", ")}
              </span>
            </p>
          )}
        </>
      )}
    </div>
  );
}
