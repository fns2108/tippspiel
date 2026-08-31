import type { Payouts } from "@/lib/payouts";
import { money, signedMoney } from "@/lib/payouts";

/**
 * The season as a ledger of who is up and who is down.
 *
 * Ordered by what people have actually won rather than by how well they have
 * picked — this is the money table, and the two orders come apart the moment
 * someone wins two weeks narrowly while someone else picks better all season.
 * Bilanz is the column that gets read: winnings minus the buy-in, which is the
 * number that settles up at the end.
 */
export function WinningsTable({
  payouts,
  members,
  meId,
}: {
  payouts: Payouts;
  members: { id: string; username: string }[];
  meId: string;
}) {
  if (!payouts.enabled) return null;

  const nameById = new Map(members.map((m) => [m.id, m.username]));
  const rows = [...payouts.byUser.values()]
    .map((r) => ({ ...r, username: nameById.get(r.userId) ?? "—" }))
    .sort(
      (a, b) =>
        b.totalCents - a.totalCents ||
        b.weeksWon - a.weeksWon ||
        a.username.localeCompare(b.username),
    );

  return (
    <section aria-labelledby="winnings" className="space-y-3">
      <div className="rule-head">
        <h2 id="winnings">Kasse</h2>
        <p className="label" data-numeric>
          Topf {money(payouts.potCents)}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-3 lg:grid-cols-5">
        <Figure
          label="Einsatz"
          value={money(payouts.perPersonCents)}
          sub={
            payouts.contributionRemainderCents === 0
              ? "pro Person"
              : `pro Person · ${payouts.contributionRemainderCents} Cent Rest`
          }
        />
        <Figure
          label="Pro Woche"
          value={money(payouts.weeklyPrizeCents)}
          sub={`${payouts.payoutWeeks.length} ${payouts.payoutWeeks.length === 1 ? "Woche" : "Wochen"}`}
        />
        <Figure
          label="Gesamtsieger"
          value={money(payouts.seasonPrizeCents)}
          sub={payouts.seasonSettled ? "verteilt" : "noch offen"}
        />
        <Figure
          label="Beste Woche"
          value={money(payouts.bestWeekPrizeCents)}
          sub={
            payouts.bestWeekPoints > 0
              ? `${payouts.bestWeekPoints} Punkte${payouts.seasonSettled ? "" : " — bisher"}`
              : "noch offen"
          }
        />
        <Figure
          label="Noch zu holen"
          value={money(payouts.pendingCents)}
          sub={payouts.pendingCents === 0 ? "alles verteilt" : "offene Wochen"}
        />
      </dl>

      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-rule text-n1">
              <th scope="col" className="py-2 text-left font-normal">
                <span className="label">Mitglied</span>
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-normal">
                <span className="label" title="Gewonnene oder geteilte Wochen">
                  Wochen
                </span>
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-normal">
                <span className="label">Wochengeld</span>
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-normal">
                <span className="label">Saisonpreis</span>
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-normal">
                <span className="label" title="Preis für die meisten Punkte in einer einzelnen Woche">
                  Beste Woche
                </span>
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-normal">
                <span className="label">Gesamt</span>
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-normal">
                <span className="label" title="Gewinn minus Einsatz">
                  Bilanz
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const me = r.userId === meId;
              return (
                <tr key={r.userId} className={`border-b border-rule ${me ? "bg-panel" : ""}`}>
                  <td className="py-2">
                    <span className={me ? "font-medium" : ""}>{r.username}</span>
                    {me && <span className="label ml-2">du</span>}
                  </td>
                  <td data-numeric className="py-2 pl-3 text-right font-mono text-n1">
                    {r.weeksWon > 0 ? r.weeksWon : <span className="text-n3">—</span>}
                  </td>
                  <td data-numeric className="py-2 pl-3 text-right font-mono">
                    {r.weeklyCents > 0 ? money(r.weeklyCents) : <span className="text-n3">—</span>}
                  </td>
                  <td data-numeric className="py-2 pl-3 text-right font-mono">
                    {r.seasonCents > 0 ? money(r.seasonCents) : <span className="text-n3">—</span>}
                  </td>
                  <td data-numeric className="py-2 pl-3 text-right font-mono">
                    {r.bestWeekCents > 0 ? money(r.bestWeekCents) : <span className="text-n3">—</span>}
                  </td>
                  <td data-numeric className="py-2 pl-3 text-right font-mono font-medium">
                    {money(r.totalCents)}
                  </td>
                  {/* The only place in the app where colour carries a number's
                      sign, because up or down is the whole point of the column. */}
                  <td
                    data-numeric
                    className={`py-2 pl-3 text-right font-mono font-medium ${
                      r.netCents > 0 ? "text-correct" : r.netCents < 0 ? "text-wrong" : "text-n2"
                    }`}
                  >
                    {signedMoney(r.netCents)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="max-w-[68ch] text-meta text-n2">
        {payouts.seasonSettled
          ? "Die Saison ist durch — der Topf ist vollständig verteilt."
          : `Saisonpreis (${money(payouts.seasonPrizeCents)}) und beste Woche ` +
            `(${money(payouts.bestWeekPrizeCents)}) werden erst nach der letzten ` +
            "Auszahlungswoche zugeteilt — bis dahin kann der Wochenrekord noch fallen. Cents, " +
            "die sich nicht gleichmäßig teilen lassen, gehen an den Gesamtsieger und sind " +
            "schon eingerechnet."}
      </p>
    </section>
  );
}

function Figure({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-paper px-3 py-3">
      <dt className="label">{label}</dt>
      <dd data-numeric className="mt-1 font-mono text-lg font-medium tabular-nums leading-none">
        {value}
      </dd>
      <dd className="mt-1 text-meta text-n2">{sub}</dd>
    </div>
  );
}
