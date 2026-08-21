import type { Metadata } from "next";
import Link from "next/link";
import { TeamConsensus } from "@/components/team-consensus";
import { requireUser } from "@/lib/auth";
import { pct } from "@/lib/format";
import { currentSeason } from "@/lib/nfl/season";
import { getScoreboard, getTeamConsensus, type Scoreboard } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Standings" };

export default async function StandingsPage() {
  const user = await requireUser();
  const season = currentSeason();

  const [board, consensus] = await Promise.all([
    getScoreboard(season),
    getTeamConsensus(season),
  ]);

  const playedWeeks = board.weeks.filter((w) => w.started);
  const hasResults = board.season.some((s) => s.decided > 0);

  return (
    <div className="space-y-10">
      <header className="rule-head">
        <h1>Standings</h1>
        <p className="label" data-numeric>
          Saison {season}
        </p>
      </header>

      {!hasResults ? (
        <div className="border border-rule bg-panel px-4 py-10 text-center">
          <h2 className="text-md">Noch nichts entschieden</h2>
          <p className="mx-auto mt-1.5 text-sm text-n1">
            Die Tabelle füllt sich, sobald Spiele beendet sind. Wochensieger stehen fest, wenn
            alle Spiele der Woche beendet sind.
          </p>
          <Link
            href="/picks"
            className="btn btn-secondary mt-4 inline-flex"
          >
            Picks abgeben
          </Link>
        </div>
      ) : (
        <>
          <SeasonTable board={board} meId={user.id} />
          <WeeklyLedger board={board} meId={user.id} season={season} />
          <TeamConsensus
            rows={consensus}
            heading="Wen die Gruppe tippt"
            meta="Alle Picks diese Saison"
          />
        </>
      )}

      {playedWeeks.length > 0 && !hasResults && (
        <p className="text-sm text-n1">Es wird gerade gespielt — schau wieder rein, wenn die Spiele durch sind.</p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- season table */

function SeasonTable({ board, meId }: { board: Scoreboard; meId: string }) {
  const leader = board.season[0]?.correct ?? 0;

  return (
    <section aria-labelledby="season-table" className="space-y-3">
      <div className="rule-head">
        <h2 id="season-table">Saison</h2>
        <p className="label">Die meisten richtigen Picks gewinnen</p>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-rule text-n1">
              <th scope="col" className="w-8 py-2 text-right font-normal">
                <span className="label">#</span>
              </th>
              <th scope="col" className="py-2 pl-3 text-left font-normal">
                <span className="label">Mitglied</span>
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-normal">
                <span className="label">Richtig</span>
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-normal">
                <span className="label">Getippt</span>
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-normal">
                <span className="label">Quote</span>
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-normal">
                <span className="label" title="Gewonnene oder geteilte Wochen">
                  Siege
                </span>
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-normal">
                <span className="label">Beste</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {board.season.map((s, i) => {
              const tiedWithLeader = s.correct === leader && leader > 0;
              const me = s.userId === meId;
              return (
                <tr
                  key={s.userId}
                  className={`border-b border-rule ${me ? "bg-panel" : ""}`}
                >
                  <td data-numeric className="py-2 text-right font-mono text-meta text-n2">
                    {i + 1}
                  </td>
                  <td className="py-2 pl-3">
                    <Link
                      href={`/u/${encodeURIComponent(s.username)}`}
                      className={`no-underline hover:underline ${
                        tiedWithLeader ? "font-semibold" : me ? "font-medium" : ""
                      }`}
                    >
                      {s.username}
                    </Link>
                    {me && <span className="label ml-2">du</span>}
                  </td>
                  <td data-numeric className="py-2 pl-3 text-right font-mono font-medium">
                    {s.correct}
                  </td>
                  <td data-numeric className="py-2 pl-3 text-right font-mono text-n1">
                    {s.decided}
                  </td>
                  <td data-numeric className="py-2 pl-3 text-right font-mono text-n1">
                    {pct(s.correct, s.decided)}
                  </td>
                  <td data-numeric className="py-2 pl-3 text-right font-mono">
                    {s.weeklyWins > 0 ? (
                      <span title={s.sharedWins > 0 ? `${s.sharedWins} geteilt` : undefined}>
                        {s.weeklyWins}
                        {s.sharedWins > 0 && <span className="text-n2">*</span>}
                      </span>
                    ) : (
                      <span className="text-n3">—</span>
                    )}
                  </td>
                  <td data-numeric className="py-2 pl-3 text-right font-mono text-n1">
                    {s.bestWeek ? `${s.bestWeek.correct}` : <span className="text-n3">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-meta text-n2">
        * enthält Wochen, die mit jemandem geteilt wurden. Bei Gleichstand zählt die Woche für
        alle mit der Höchstpunktzahl als Sieg.
      </p>
    </section>
  );
}

/* -------------------------------------------------------- weekly ledger */

function WeeklyLedger({
  board,
  meId,
  season,
}: {
  board: Scoreboard;
  meId: string;
  season: number;
}) {
  const weeks = board.weeks.filter((w) => w.started).reverse();
  if (weeks.length === 0) return null;

  return (
    <section aria-labelledby="weekly" className="space-y-3">
      <div className="rule-head">
        <h2 id="weekly">Nach Woche</h2>
        <p className="label">Gleichstand wird geteilt</p>
      </div>

      <ul className="border-t border-rule">
        {weeks.map((w) => {
          const mine = w.rows.find((r) => r.userId === meId);
          const top = w.rows[0]?.correct ?? 0;
          const winners = w.winnerIds.map(
            (id) => board.members.find((m) => m.id === id)?.username ?? "—",
          );

          return (
            <li
              key={w.ref.ordinal}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule py-2.5"
            >
              <Link
                href={`/week/${season}/${w.ref.ordinal}`}
                className="w-24 shrink-0 text-sm font-medium no-underline hover:underline"
              >
                {w.ref.label}
              </Link>

              <span className="min-w-0 flex-1 text-sm">
                {w.complete ? (
                  winners.length > 0 ? (
                    <>
                      <span className="text-n1">
                        {winners.length > 1 ? "Geteilt von " : "Gewonnen von "}
                      </span>
                      <span className="font-medium">{winners.join(", ")}</span>
                      <span data-numeric className="ml-2 font-mono text-meta text-n2">
                        {top}/{w.totalGames}
                      </span>
                    </>
                  ) : (
                    <span className="text-n2">Niemand hat gepunktet</span>
                  )
                ) : (
                  <span className="text-n1">
                    Läuft
                    <span data-numeric className="ml-2 font-mono text-meta text-n2">
                      {w.finalGames}/{w.totalGames} beendet
                    </span>
                  </span>
                )}
              </span>

              <span data-numeric className="font-mono text-meta text-n1">
                <span className="label mr-1.5">du</span>
                {mine?.correct ?? 0}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
