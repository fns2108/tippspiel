import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertIcon, ClockIcon } from "@/components/icons";
import { LiveRefresh } from "@/components/live-refresh";
import { LocalTime } from "@/components/local-time";
import { PickRow } from "@/components/pick-row";
import { WeekRail } from "@/components/week-rail";
import { requireUser } from "@/lib/auth";
import { SERVER_TZ, countdown, formatDayAndTime } from "@/lib/format";
import { currentSeason, isValidOrdinal } from "@/lib/nfl/season";
import { getCurrentWeekOrdinal } from "@/lib/queries";
import { buildWeekRail, loadWeekView } from "@/lib/week-view";

export const dynamic = "force-dynamic";

type Params = { ordinal?: string[] };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { ordinal } = await params;
  const n = ordinal?.[0];
  return { title: n ? `Woche ${n} Picks` : "Picks" };
}

export default async function PicksPage({ params }: { params: Promise<Params> }) {
  const user = await requireUser();
  const season = currentSeason();
  const { ordinal: segments } = await params;

  const requested = segments?.[0];
  let ordinal: number;
  if (requested === undefined) {
    ordinal = (await getCurrentWeekOrdinal(season)) ?? 1;
  } else {
    ordinal = Number(requested);
    if (!isValidOrdinal(ordinal)) notFound();
  }

  const [view, rail] = await Promise.all([
    loadWeekView(season, ordinal, user.id),
    buildWeekRail(season, ordinal),
  ]);

  const myPickedCount = view.myPicks.size;

  return (
    <div className="space-y-5">
      <header className="rule-head">
        <div className="flex items-baseline gap-3">
          <h1>{view.ref.label}</h1>
          <LiveRefresh active={view.liveCount > 0} />
        </div>
        <p className="label" data-numeric>
          {myPickedCount}/{view.totalGames} getippt
        </p>
      </header>

      <WeekRail weeks={rail} current={ordinal} hrefBase="/picks" />

      {view.totalGames === 0 ? (
        <EmptyWeek label={view.ref.label} season={season} />
      ) : (
        // The picking column is measured rather than full-bleed: at desktop
        // width a stretched row puts the team name a long way from its score.
        <div className="max-w-[48rem] space-y-5">
          {view.unpicked.length > 0 && view.nextLock ? (
            <OpenPicksBanner count={view.unpicked.length} nextKickoff={view.nextLock.kickoff} />
          ) : view.openGames.length > 0 ? (
            <p className="flex items-center gap-2 border border-rule bg-panel px-3 py-2.5 text-sm text-n1">
              <span aria-hidden className="text-correct">
                <ClockIcon />
              </span>
              Alle {view.totalGames} Spiele getippt. Du kannst alles ändern, was noch nicht
              angepfiffen ist.
            </p>
          ) : null}

          <div className="space-y-7">
            {view.groups.map((group) => (
              <section key={group.key} aria-labelledby={`day-${group.key}`}>
                <h2
                  id={`day-${group.key}`}
                  className="label mb-1 border-b border-ink pb-1.5"
                >
                  {group.label}
                  <span className="ml-2 font-normal tracking-normal normal-case text-n2">
                    {group.games.length} {group.games.length === 1 ? "Spiel" : "Spiele"}
                  </span>
                </h2>
                <ul>
                  {group.games.map((g) => (
                    <PickRow
                      key={g.id}
                      game={view.cards.get(g.id)!}
                      initialPick={view.myPicks.get(g.id) ?? null}
                      pickedBy={view.pickedByGame.get(g.id) ?? []}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <p className="pt-2 text-meta text-n2">
            Die Picks aller erscheinen hier, sobald das Spiel angepfiffen ist. Bis dahin siehst
            nur du deine eigenen.
          </p>
        </div>
      )}
    </div>
  );
}

function OpenPicksBanner({ count, nextKickoff }: { count: number; nextKickoff: Date }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-ink bg-panel px-3 py-2.5">
      <span aria-hidden className="text-ink">
        <AlertIcon />
      </span>
      <p className="text-sm font-medium">
        {count} {count === 1 ? "Spiel" : "Spiele"} noch offen
      </p>
      <p className="text-sm text-n1">
        Erste Sperre{" "}
        <LocalTime
          iso={nextKickoff.toISOString()}
          fallback={formatDayAndTime(nextKickoff, SERVER_TZ)}
          mode="full"
          className="font-medium text-ink"
        />{" "}
        <span className="font-mono tabular-nums text-n2">· in {countdown(nextKickoff)}</span>
      </p>
    </div>
  );
}

function EmptyWeek({ label, season }: { label: string; season: number }) {
  return (
    <div className="border border-rule bg-panel px-4 py-8 text-center">
      <h2 className="text-md">{label} ist noch nicht angesetzt</h2>
      <p className="mx-auto mt-1.5 text-sm text-n1">
        Der Spielplan {season} für diese Woche ist noch nicht veröffentlicht. Er erscheint hier
        automatisch, sobald es so weit ist.
      </p>
      <Link
        href="/picks"
        className="mt-4 inline-block border border-rule px-3 py-1.5 text-sm no-underline hover:bg-sunken"
      >
        Zurück zur aktuellen Woche
      </Link>
    </div>
  );
}
