"use client";

import { useState, useTransition } from "react";
import { clearPick, setPick } from "@/app/actions/picks";
import { CheckIcon, CrossIcon, LockIcon } from "@/components/icons";
import { LocalTime } from "@/components/local-time";
import { TeamLogo } from "@/components/team-logo";
import { formatSpread } from "@/lib/format";
import { teamColorVars } from "@/lib/nfl/colors";

export type TeamCard = {
  id: string;
  abbrev: string;
  location: string;
  name: string;
  displayName: string;
  color: string | null;
  altColor: string | null;
};

/** Serializable view of a game — Dates become ISO strings at the boundary. */
export type GameCard = {
  id: string;
  kickoffIso: string;
  kickoffFallback: string;
  neutralSite: boolean;
  status: "pre" | "in" | "post";
  statusDetail: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamId: string | null;
  isTie: boolean;
  spread: number | null;
  locked: boolean;
  home: TeamCard;
  away: TeamCard;
};

export type PickedBy = { userId: string; username: string; teamId: string };

function TeamSide({
  team,
  side,
  game,
  selected,
  disabled,
  pending,
  onPick,
}: {
  team: TeamCard;
  side: "home" | "away";
  game: GameCard;
  selected: boolean;
  disabled: boolean;
  pending: boolean;
  onPick: () => void;
}) {
  const isHome = side === "home";
  const score = isHome ? game.homeScore : game.awayScore;
  const showScore = game.status !== "pre" && score !== null;

  // Home-relative spread, flipped for the away side.
  const sideSpread = game.spread === null ? null : isHome ? game.spread : -game.spread;

  const final = game.status === "post";
  const won = final && game.winnerTeamId === team.id;
  const lost = final && game.winnerTeamId !== null && game.winnerTeamId !== team.id;

  const outcome = final ? (won ? " — won" : game.isTie ? " — tied" : " — lost") : "";
  const label = game.locked
    ? `${team.displayName}${isHome ? ", at home" : ", away"}${outcome}${selected ? " — your pick" : ""}`
    : `${selected ? "Your pick: " : "Pick "}${team.displayName}${isHome ? ", at home" : ", away"}`;

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={label}
      style={teamColorVars(team.color, team.altColor)}
      className={[
        "group relative flex min-h-[var(--tap)] w-full items-center gap-2.5 rounded-[3px] border px-2.5 py-2 text-left transition-colors duration-150",
        isHome ? "flex-row-reverse text-right" : "",
        selected
          ? "border-ink bg-ink text-ink-on"
          : "border-rule bg-paper text-ink",
        disabled
          ? "cursor-default"
          : "cursor-pointer hover:border-n3 hover:bg-panel active:translate-y-px",
        pending ? "opacity-60" : "",
        // A losing side of a finished game recedes; it is no longer live information.
        lost && !selected ? "opacity-55" : "",
      ].join(" ")}
    >
      <TeamLogo
        team={team}
        size={26}
        onInverted={selected}
        className={lost && !won ? "opacity-70" : ""}
      />

      <span className={`flex min-w-0 flex-1 flex-col ${isHome ? "items-end" : "items-start"}`}>
        <span className="flex items-baseline gap-1.5">
          <span className="text-md font-semibold leading-none tracking-[-0.02em]">
            {team.abbrev}
          </span>
          {sideSpread !== null && !showScore && (
            <span
              className={`text-meta tabular-nums ${selected ? "text-ink-on/65" : "text-n2"}`}
              title={sideSpread < 0 ? "Favoured by the bookmakers" : "Underdog"}
            >
              {formatSpread(sideSpread)}
            </span>
          )}
        </span>
        <span
          className={`w-full truncate text-meta leading-tight ${
            selected ? "text-ink-on/70" : "text-n1"
          }`}
        >
          {team.name}
        </span>
      </span>

      {showScore && (
        <span
          data-numeric
          className={`font-mono text-lg leading-none ${won ? "font-bold" : "font-medium"} ${
            // A selected button is filled with --ink, so its ground is inverted.
            // De-emphasis has to come from the inverted colour, not the
            // page-relative neutrals, or it drops below contrast in dark mode.
            lost ? (selected ? "text-ink-on/55" : "text-n2") : ""
          }`}
        >
          {score}
        </span>
      )}

      {selected && (
        <span
          aria-hidden
          className={`absolute -top-px -right-px flex h-4 w-4 items-center justify-center rounded-bl-[3px] ${
            final
              ? won
                ? "bg-correct text-paper"
                : "bg-wrong text-paper"
              : "bg-ink-on text-ink"
          }`}
          style={isHome ? { right: "auto", left: "-1px", borderRadius: "0 0 3px 0" } : undefined}
        >
          {/* Before kickoff the mark means "this is your pick". Once the game is
              final it has to mean right or wrong — a tick on a game you lost
              reads as correct. */}
          {final && !won ? <CrossIcon size={11} /> : <CheckIcon size={11} />}
        </span>
      )}
    </button>
  );
}

/** Who picked which side, revealed only once the game has kicked off. */
function Consensus({ game, pickedBy }: { game: GameCard; pickedBy: PickedBy[] }) {
  if (pickedBy.length === 0) return null;
  const final = game.status === "post";

  const sides = [game.away, game.home].map((team) => ({
    team,
    members: pickedBy.filter((p) => p.teamId === team.id),
    correct: final && game.winnerTeamId === team.id,
    wrong: final && game.winnerTeamId !== null && game.winnerTeamId !== team.id,
  }));

  // Who backed whom is the point of the page after kickoff, so the names wrap
  // rather than truncate — one column on a phone, two once there is room for
  // both sides side by side.
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1 border-t border-rule pt-2 pb-3 text-meta sm:grid-cols-2">
      {sides.map(({ team, members, correct, wrong }) => (
        <div key={team.id} className="flex min-w-0 items-baseline gap-1.5">
          <dt
            className="label shrink-0 tabular-nums"
            style={teamColorVars(team.color, team.altColor)}
          >
            <span className="team-text">{team.abbrev}</span>
            <span className="ml-1 text-n2">{members.length}</span>
          </dt>
          <dd
            className={`min-w-0 flex-1 [overflow-wrap:anywhere] ${
              correct ? "text-correct" : wrong ? "text-n2" : "text-n1"
            }`}
          >
            {members.length === 0 ? (
              <span className="text-n3">nobody</span>
            ) : (
              <>
                {final && (
                  <span aria-hidden className="mr-1 inline-block translate-y-px">
                    {correct ? <CheckIcon size={11} /> : <CrossIcon size={11} />}
                  </span>
                )}
                {members.map((m) => m.username).join(", ")}
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function PickRow({
  game,
  initialPick,
  pickedBy,
}: {
  game: GameCard;
  initialPick: string | null;
  pickedBy: PickedBy[];
}) {
  const [pick, setPickState] = useState<string | null>(initialPick);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(teamId: string) {
    if (game.locked) return;
    const previous = pick;
    // Tapping the current pick clears it, so a game can be left genuinely blank.
    const next = previous === teamId ? null : teamId;

    setPickState(next);
    setError(null);

    startTransition(async () => {
      const result = next === null ? await clearPick(game.id) : await setPick(game.id, next);
      if (!result.ok) {
        setPickState(previous);
        setError(result.error);
      }
    });
  }

  const live = game.status === "in";

  return (
    <li className="border-b border-rule last:border-b-0">
      <div className="flex items-baseline justify-between gap-3 py-2">
        <div className="flex items-baseline gap-2">
          <LocalTime
            iso={game.kickoffIso}
            fallback={game.kickoffFallback}
            className="font-mono text-meta tabular-nums text-n1"
          />
          {live && (
            <span className="inline-flex items-center gap-1 text-micro font-semibold uppercase tracking-[0.08em] text-live">
              <span aria-hidden className="live-dot h-1.5 w-1.5 rounded-full bg-live" />
              {game.statusDetail ?? "Live"}
            </span>
          )}
          {game.status === "post" && (
            <span className="label text-n2">{game.statusDetail ?? "Final"}</span>
          )}
          {game.locked && game.status === "pre" && (
            <span className="inline-flex items-center gap-1 text-micro font-semibold uppercase tracking-[0.08em] text-n2">
              <LockIcon size={11} /> Locked
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-2.5 text-meta text-n2">
          {game.neutralSite && <span>Neutral site</span>}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-1.5 pb-2.5">
        <TeamSide
          team={game.away}
          side="away"
          game={game}
          selected={pick === game.away.id}
          disabled={game.locked}
          pending={pending}
          onPick={() => choose(game.away.id)}
        />
        <span
          aria-hidden
          className="self-center px-0.5 text-meta font-medium text-n3"
          title={game.neutralSite ? "Neutral site" : "at"}
        >
          {game.neutralSite ? "vs" : "@"}
        </span>
        <TeamSide
          team={game.home}
          side="home"
          game={game}
          selected={pick === game.home.id}
          disabled={game.locked}
          pending={pending}
          onPick={() => choose(game.home.id)}
        />
      </div>

      {error && (
        <p role="alert" className="pb-2 text-meta text-wrong">
          {error}
        </p>
      )}

      {game.locked && <Consensus game={game} pickedBy={pickedBy} />}
    </li>
  );
}
