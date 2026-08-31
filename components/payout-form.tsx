"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { savePayoutSettingsAction, type AdminState } from "@/app/actions/admin";
import { money } from "@/lib/payouts";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary">
      {pending ? "Wird gespeichert…" : "Speichern"}
    </button>
  );
}

/**
 * The three numbers that decide the money, with the arithmetic they imply
 * shown underneath.
 *
 * The summary is rendered by the server from the saved values, not recomputed
 * live from the inputs: a figure that moves while you are still typing invites
 * you to trust a pot that has not been saved yet.
 */
export function PayoutForm({
  potCents,
  seasonPrizeCents,
  bestWeekPrizeCents,
  includePlayoffs,
  summary,
}: {
  potCents: number;
  seasonPrizeCents: number;
  bestWeekPrizeCents: number;
  includePlayoffs: boolean;
  summary: React.ReactNode;
}) {
  const [state, action] = useActionState<AdminState, FormData>(savePayoutSettingsAction, {
    error: null,
    notice: null,
  });

  // Prefilled as a plain number so the field is easy to retype, not as "20,00 €".
  const asAmount = (cents: number) => (cents === 0 ? "" : (cents / 100).toFixed(2).replace(".", ","));

  return (
    <form action={action} className="space-y-3 border border-rule px-3 py-3">
      <div className="grid gap-3 sm:grid-cols-[9rem_9rem_9rem_1fr]">
        <div>
          <label htmlFor="p-buyin" className="label mb-1.5 block">
            Einsatz
          </label>
          <input
            id="p-buyin"
            name="pot"
            defaultValue={asAmount(potCents)}
            placeholder="160,00"
            inputMode="decimal"
            autoComplete="off"
            aria-describedby="p-buyin-hint"
            className="input tabular-nums"
          />
          <p id="p-buyin-hint" className="mt-1.5 text-meta text-n1">
            Alles zusammen. Leer oder 0 schaltet Auszahlungen aus.
          </p>
        </div>

        <div>
          <label htmlFor="p-season" className="label mb-1.5 block">
            Gesamtsieger
          </label>
          <input
            id="p-season"
            name="seasonPrize"
            defaultValue={asAmount(seasonPrizeCents)}
            placeholder="50,00"
            inputMode="decimal"
            autoComplete="off"
            aria-describedby="p-season-hint"
            className="input tabular-nums"
          />
          <p id="p-season-hint" className="mt-1.5 text-meta text-n1">
            Kommt vom Topf weg, bevor die Wochen geteilt werden.
          </p>
        </div>

        <div>
          <label htmlFor="p-best" className="label mb-1.5 block">
            Beste Woche
          </label>
          <input
            id="p-best"
            name="bestWeekPrize"
            defaultValue={asAmount(bestWeekPrizeCents)}
            placeholder="20,00"
            inputMode="decimal"
            autoComplete="off"
            aria-describedby="p-best-hint"
            className="input tabular-nums"
          />
          <p id="p-best-hint" className="mt-1.5 text-meta text-n1">
            Für die meisten Punkte in einer einzelnen Woche.
          </p>
        </div>

        <div className="flex items-start pt-[1.6rem]">
          <label htmlFor="p-playoffs" className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              id="p-playoffs"
              name="includePlayoffs"
              type="checkbox"
              defaultChecked={includePlayoffs}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--ink)]"
            />
            <span>
              Playoffs zahlen mit
              <span className="mt-0.5 block text-meta text-n1">
                Wild Card bis Super Bowl zählen als Auszahlungswochen. Aus: nur Woche 1–18.
              </span>
            </span>
          </label>
        </div>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-wrong">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p role="status" className="text-sm text-correct">
          {state.notice}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-3">
        {summary}
        <Submit />
      </div>
    </form>
  );
}

/** Shown under the form: what the saved numbers actually work out to. */
export function PayoutSummary({
  players,
  perPersonCents,
  remainderCents,
  weeks,
  weeklyPrizeCents,
  seasonPrizeCents,
  bestWeekPrizeCents,
  enabled,
}: {
  players: number;
  perPersonCents: number;
  remainderCents: number;
  weeks: number;
  weeklyPrizeCents: number;
  seasonPrizeCents: number;
  bestWeekPrizeCents: number;
  enabled: boolean;
}) {
  if (!enabled) {
    return <p className="text-meta text-n1">Diese Saison wird um nichts gespielt.</p>;
  }
  return (
    <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-meta">
      <span className="flex items-baseline gap-1.5">
        <dt className="label">Pro Person</dt>
        <dd data-numeric className="font-mono font-medium">
          {money(perPersonCents)}
        </dd>
        <dd className="text-n2">
          ({players} {players === 1 ? "Mitglied" : "Mitglieder"}
          {remainderCents > 0 ? `, ${remainderCents} Cent Rest` : ""})
        </dd>
      </span>
      <span className="flex items-baseline gap-1.5">
        <dt className="label">Pro Woche</dt>
        <dd data-numeric className="font-mono font-medium">
          {money(weeklyPrizeCents)}
        </dd>
        <dd className="text-n2">({weeks} Wochen)</dd>
      </span>
      <span className="flex items-baseline gap-1.5">
        <dt className="label">Gesamtsieger</dt>
        <dd data-numeric className="font-mono font-medium">
          {money(seasonPrizeCents)}
        </dd>
      </span>
      <span className="flex items-baseline gap-1.5">
        <dt className="label">Beste Woche</dt>
        <dd data-numeric className="font-mono font-medium">
          {money(bestWeekPrizeCents)}
        </dd>
      </span>
    </dl>
  );
}
