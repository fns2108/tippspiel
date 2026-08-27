import type { Metadata } from "next";
import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { overrideResultAction, resyncWeekAction, revokeInviteKeyAction } from "@/app/actions/admin";
import { CopyKey, InviteKeyForm } from "@/components/invite-key-form";
import { PayoutForm, PayoutSummary } from "@/components/payout-form";
import { RefreshIcon } from "@/components/icons";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { games, inviteKeys, syncState, users } from "@/lib/db/schema";
import { SERVER_TZ, formatDate, formatDayAndTime } from "@/lib/format";
import { allWeekRefs, currentSeason, weekRef } from "@/lib/nfl/season";
import { getPoolSettings, payoutsFromBoard } from "@/lib/pool";
import { getCurrentWeekOrdinal, getScoreboard, getWeekGames } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();
  const season = currentSeason();
  const ordinal = (await getCurrentWeekOrdinal(season)) ?? 1;

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${h.get("host") ?? "localhost:3000"}`;

  const [keys, members, weekGames, syncRows, settings, board] = await Promise.all([
    db.select().from(inviteKeys).orderBy(desc(inviteKeys.createdAt)),
    db.select({ id: users.id, username: users.username, isAdmin: users.isAdmin, createdAt: users.createdAt }).from(users).orderBy(users.usernameLower),
    getWeekGames(season, ordinal),
    db.select().from(syncState).orderBy(desc(syncState.lastSyncedAt)).limit(6),
    getPoolSettings(season),
    getScoreboard(season),
  ]);

  const payouts = payoutsFromBoard(settings, board);

  const failing = syncRows.filter((r) => r.lastError);

  return (
    <div className="space-y-10">
      <header className="rule-head">
        <h1>Admin</h1>
        <p className="label" data-numeric>
          {members.length} {members.length === 1 ? "Mitglied" : "Mitglieder"}
        </p>
      </header>

      {failing.length > 0 && (
        <section className="border border-wrong bg-wrong-soft px-3 py-2.5">
          <h2 className="text-sm font-medium text-wrong">Letzte Sync-Fehler</h2>
          <ul className="mt-1 space-y-0.5">
            {failing.map((r) => (
              <li key={r.key} className="font-mono text-meta text-wrong">
                {r.key}: {r.lastError}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-meta text-n1">
            Die Seiten zeigen den zuletzt bekannten Stand. Versuch unten einen erneuten Abruf.
          </p>
        </section>
      )}

      <section aria-labelledby="keys" className="space-y-3">
        <div className="rule-head">
          <h2 id="keys">Invite-Keys</h2>
          <p className="label">Zum Registrieren nötig</p>
        </div>

        <InviteKeyForm />

        {keys.length === 0 ? (
          <p className="text-sm text-n1">Noch keine Keys.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <table className="w-full min-w-[38rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-rule">
                  <th scope="col" className="py-2 text-left"><span className="label">Key</span></th>
                  <th scope="col" className="py-2 pl-3 text-left"><span className="label">Bezeichnung</span></th>
                  <th scope="col" className="py-2 pl-3 text-right"><span className="label">Genutzt</span></th>
                  <th scope="col" className="py-2 pl-3 text-left"><span className="label">Status</span></th>
                  <th scope="col" className="py-2 pl-3"><span className="sr-only">Aktionen</span></th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => {
                  const spent = k.usedCount >= k.maxUses;
                  const expired = k.expiresAt !== null && k.expiresAt < new Date();
                  const dead = spent || expired || k.revokedAt !== null;
                  return (
                    <tr key={k.code} className="border-b border-rule">
                      <td className="py-2">
                        <span
                          className={`font-mono tracking-[0.06em] ${dead ? "text-n2 line-through" : ""}`}
                        >
                          {k.code}
                        </span>
                      </td>
                      <td className="py-2 pl-3 text-n1">{k.label ?? "—"}</td>
                      <td data-numeric className="py-2 pl-3 text-right font-mono text-meta">
                        {k.usedCount}/{k.maxUses}
                      </td>
                      <td className="py-2 pl-3 text-meta">
                        {k.revokedAt ? (
                          <span className="text-n2">Widerrufen</span>
                        ) : spent ? (
                          <span className="text-n2">Aufgebraucht</span>
                        ) : expired ? (
                          <span className="text-n2">Abgelaufen</span>
                        ) : (
                          <span className="text-correct">Aktiv</span>
                        )}
                      </td>
                      <td className="py-2 pl-3">
                        <span className="flex items-center justify-end gap-1">
                          {!dead && <CopyKey code={k.code} origin={origin} />}
                          {!dead && (
                            <form action={revokeInviteKeyAction}>
                              <input type="hidden" name="code" value={k.code} />
                              <button
                                type="submit"
                                className="px-2 py-1 text-meta text-n1 hover:text-wrong"
                              >
                                Widerrufen
                              </button>
                            </form>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="payouts" className="space-y-3">
        <div className="rule-head">
          <h2 id="payouts">Auszahlungen</h2>
          <p className="label">Saison {season}</p>
        </div>
        <p className="max-w-[60ch] text-sm text-n1">
          Alle Einsätze bilden einen Topf. Gesamtsieger und beste Woche werden vorweg
          abgezogen, der Rest wird gleichmäßig auf die Auszahlungswochen verteilt. Wer eine
          Woche gewinnt, bekommt ihren Anteil; bei Gleichstand wird geteilt. Cents, die nicht
          aufgehen, gehen an den Gesamtsieger — so bleibt der Topf am Ende genau aufgeteilt.
        </p>
        <PayoutForm
          buyInCents={settings.buyInCents}
          seasonPrizeCents={settings.seasonPrizeCents}
          bestWeekPrizeCents={settings.bestWeekPrizeCents}
          includePlayoffs={settings.includePlayoffs}
          summary={
            <PayoutSummary
              enabled={payouts.enabled}
              players={payouts.players}
              potCents={payouts.potCents}
              weeks={payouts.payoutWeeks.length}
              weeklyPrizeCents={payouts.weeklyPrizeCents}
              seasonPrizeCents={payouts.seasonPrizeFloorCents}
              bestWeekPrizeCents={payouts.bestWeekPrizeCents}
            />
          }
        />
      </section>

      <section aria-labelledby="data" className="space-y-3">
        <div className="rule-head">
          <h2 id="data">Daten</h2>
          <p className="label">Saison {season}</p>
        </div>
        <form action={resyncWeekAction} className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="resync-week" className="label mb-1.5 block">
              Woche neu laden
            </label>
            <select
              id="resync-week"
              name="ordinal"
              defaultValue={String(ordinal)}
              className="input w-44"
            >
              {allWeekRefs().map((r) => (
                <option key={r.ordinal} value={r.ordinal}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-secondary">
            <RefreshIcon />
            Jetzt laden
          </button>
        </form>
        {syncRows.length > 0 && (
          <p className="text-meta text-n2">
            Zuletzt geladen: {formatDayAndTime(syncRows[0].lastSyncedAt, SERVER_TZ)} ({SERVER_TZ})
          </p>
        )}
      </section>

      <section aria-labelledby="results" className="space-y-3">
        <div className="rule-head">
          <h2 id="results">Ergebnis korrigieren</h2>
          <p className="label">{weekRef(ordinal).label}</p>
        </div>
        <p className="text-sm text-n1">
          Nur nötig, wenn der Feed ein Ergebnis falsch hat. Ein korrigiertes Spiel wird vom Sync
          nicht mehr angefasst, bis du es wieder freigibst.
        </p>
        <ul className="border-t border-rule">
          {weekGames.map((g) => (
            <li
              key={g.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule py-2"
            >
              <span className="w-40 shrink-0 font-mono text-meta">
                {g.away.abbrev} {g.neutralSite ? "vs" : "@"} {g.home.abbrev}
              </span>
              <span data-numeric className="w-16 shrink-0 font-mono text-meta text-n1">
                {g.status === "pre" ? "—" : `${g.awayScore}–${g.homeScore}`}
              </span>
              <form action={overrideResultAction} className="flex items-center gap-2">
                <input type="hidden" name="gameId" value={g.id} />
                <label htmlFor={`o-${g.id}`} className="sr-only">
                  Ergebnis für {g.away.abbrev} bei {g.home.abbrev}
                </label>
                <select
                  id={`o-${g.id}`}
                  name="outcome"
                  defaultValue={g.isTie ? "tie" : (g.winnerTeamId ?? "")}
                  className="input h-9 min-h-0 w-40 py-1 text-sm"
                >
                  <option value="">Sieger wählen…</option>
                  <option value={g.away.id}>{g.away.displayName}</option>
                  <option value={g.home.id}>{g.home.displayName}</option>
                  <option value="tie">Unentschieden</option>
                  <option value="release">Wieder an den Feed</option>
                </select>
                <button type="submit" className="btn btn-secondary h-9 min-h-0 px-3 py-1 text-meta">
                  Übernehmen
                </button>
              </form>
              {g.status === "post" && (
                <span className="label">{g.statusDetail?.includes("korrigiert") ? "korrigiert" : ""}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="members" className="space-y-3">
        <div className="rule-head">
          <h2 id="members">Mitglieder</h2>
        </div>
        <ul className="border-t border-rule">
          {members.map((m) => (
            <li key={m.id} className="flex items-baseline gap-3 border-b border-rule py-2">
              <span className="flex-1 text-sm">{m.username}</span>
              {m.isAdmin && <span className="label">admin</span>}
              <span className="font-mono text-meta text-n2">
                dabei seit {formatDate(m.createdAt, SERVER_TZ)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
