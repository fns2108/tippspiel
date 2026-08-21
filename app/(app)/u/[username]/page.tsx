import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { LogoutIcon } from "@/components/icons";
import { PushToggle } from "@/components/push-toggle";
import { TeamConsensus } from "@/components/team-consensus";
import { requireUser } from "@/lib/auth";
import { pct } from "@/lib/format";
import { currentSeason } from "@/lib/nfl/season";
import {
  findUserByUsername,
  getHeadToHead,
  getScoreboard,
  getUserTeamBreakdown,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: decodeURIComponent(username) };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const viewer = await requireUser();
  const { username } = await params;
  const season = currentSeason();

  const subject = await findUserByUsername(decodeURIComponent(username));
  if (!subject) notFound();

  const isMe = subject.id === viewer.id;

  const [board, byTeam, h2h] = await Promise.all([
    getScoreboard(season),
    getUserTeamBreakdown(season, subject.id),
    isMe
      ? Promise.resolve({ disagreements: 0, aWon: 0, bWon: 0 })
      : getHeadToHead(season, viewer.id, subject.id),
  ]);

  const rank = board.season.findIndex((s) => s.userId === subject.id);
  const record = board.season[rank];
  const weeks = board.weeks.filter((w) => w.started);
  const mostGamesInAWeek = Math.max(
    1,
    ...weeks.map((w) => w.rows.find((r) => r.userId === subject.id)?.decided ?? 0),
  );

  return (
    <div className="space-y-9">
      <header className="rule-head">
        <div className="flex items-baseline gap-3">
          <h1>{subject.username}</h1>
          {isMe && <span className="label">du</span>}
        </div>
        {record && record.decided > 0 && (
          <p className="label" data-numeric>
            #{rank + 1} von {board.season.length}
          </p>
        )}
      </header>

      {!record || record.decided === 0 ? (
        <p className="border border-rule bg-panel px-4 py-8 text-center text-sm text-n1">
          Diese Saison ist noch nichts entschieden.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-4">
            <Stat label="Richtig" value={String(record.correct)} sub={`von ${record.decided}`} />
            <Stat label="Quote" value={pct(record.correct, record.decided)} />
            <Stat
              label="Wochen gewonnen"
              value={String(record.weeklyWins)}
              sub={record.sharedWins > 0 ? `${record.sharedWins} geteilt` : undefined}
            />
            <Stat
              label="Beste Woche"
              value={record.bestWeek ? String(record.bestWeek.correct) : "—"}
              sub={record.bestWeek ? `Woche ${record.bestWeek.ordinal}` : undefined}
            />
          </dl>

          {!isMe && h2h.disagreements > 0 && (
            <section aria-labelledby="h2h" className="space-y-3">
              <div className="rule-head">
                <h2 id="h2h">Du gegen {subject.username}</h2>
                <p className="label">Spiele, die ihr unterschiedlich getippt habt</p>
              </div>
              <p className="text-sm">
                Von <strong className="font-mono tabular-nums">{h2h.disagreements}</strong> Spielen,
                die ihr unterschiedlich getippt habt, lagst du{" "}
                <strong className="font-mono tabular-nums">{h2h.aWon}</strong>-mal richtig und{" "}
                {subject.username}{" "}
                <strong className="font-mono tabular-nums">{h2h.bWon}</strong>-mal.
              </p>
            </section>
          )}

          <section aria-labelledby="by-week" className="space-y-3">
            <div className="rule-head">
              <h2 id="by-week">Woche für Woche</h2>
            </div>
            <ul className="border-t border-rule">
              {weeks.map((w) => {
                const row = w.rows.find((r) => r.userId === subject.id);
                const won = w.winnerIds.includes(subject.id);
                const correct = row?.correct ?? 0;
                return (
                  <li
                    key={w.ref.ordinal}
                    className="flex items-center gap-3 border-b border-rule py-2"
                  >
                    <Link
                      href={`/week/${season}/${w.ref.ordinal}`}
                      className="w-24 shrink-0 text-sm no-underline hover:underline"
                    >
                      {w.ref.label}
                    </Link>
                    {/* Same idiom as the consensus bars: the track is how many
                        games there were to get right, the fill is how many were.
                        Scaling by raw count alone would make a two-game playoff
                        round look like a collapse next to a sixteen-game week. */}
                    <span className="min-w-0 flex-1">
                      <span
                        className="relative block h-2.5 bg-sunken"
                        style={{ width: `${Math.max(6, ((row?.decided ?? 0) / mostGamesInAWeek) * 100)}%` }}
                      >
                        <span
                          className={`absolute inset-y-0 left-0 block ${won ? "bg-ink" : "bg-n3"}`}
                          style={{
                            width: row && row.decided > 0 ? `${(correct / row.decided) * 100}%` : "0%",
                          }}
                        />
                      </span>
                    </span>
                    <span data-numeric className="shrink-0 font-mono text-meta text-n1">
                      {correct}/{row?.decided ?? 0}
                    </span>
                    <span className="w-16 shrink-0 text-right">
                      {won && (
                        <span className="label">
                          {w.winnerIds.length > 1 ? "geteilt" : "gewonnen"}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <TeamConsensus
            rows={byTeam}
            heading={isMe ? "Wen du tippst" : `Wen ${subject.username} tippt`}
            meta={`Saison ${season}`}
            subject={isMe ? "du" : subject.username}
          />
        </>
      )}

      {isMe && (
        <section aria-labelledby="account" className="space-y-3">
          <div className="rule-head">
            <h2 id="account">Konto</h2>
          </div>
          <PushToggle />
          <form action={logoutAction}>
            <button type="submit" className="btn btn-secondary">
              <LogoutIcon />
              Abmelden
            </button>
          </form>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-paper px-3 py-3">
      <dt className="label">{label}</dt>
      <dd className="mt-1 font-mono text-xl font-medium tabular-nums leading-none">{value}</dd>
      {sub && <dd className="mt-1 text-meta text-n2">{sub}</dd>}
    </div>
  );
}
