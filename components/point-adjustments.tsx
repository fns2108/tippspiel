"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  addPointAdjustmentAction,
  deletePointAdjustmentAction,
  type AdminState,
} from "@/app/actions/admin";
import { PlusIcon } from "@/components/icons";

export type AdjustmentView = {
  id: string;
  username: string;
  weekLabel: string;
  points: number;
  note: string | null;
  createdLabel: string;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary">
      <PlusIcon />
      {pending ? "Wird gespeichert…" : "Korrektur speichern"}
    </button>
  );
}

const signed = (n: number) => `${n > 0 ? "+" : "−"}${Math.abs(n)}`;

export function PointAdjustments({
  members,
  weeks,
  defaultOrdinal,
  adjustments,
}: {
  members: { id: string; username: string }[];
  weeks: { ordinal: number; label: string }[];
  defaultOrdinal: number;
  adjustments: AdjustmentView[];
}) {
  const [state, action] = useActionState<AdminState, FormData>(addPointAdjustmentAction, {
    error: null,
    notice: null,
  });

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3 border border-rule px-3 py-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem_7rem]">
          <div>
            <label htmlFor="pa-user" className="label mb-1.5 block">
              Mitglied
            </label>
            <select id="pa-user" name="userId" defaultValue="" className="input" required>
              <option value="" disabled>
                Auswählen…
              </option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.username}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pa-week" className="label mb-1.5 block">
              Woche
            </label>
            <select id="pa-week" name="ordinal" defaultValue={String(defaultOrdinal)} className="input">
              {weeks.map((w) => (
                <option key={w.ordinal} value={w.ordinal}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pa-points" className="label mb-1.5 block">
              Punkte
            </label>
            <input
              id="pa-points"
              name="points"
              placeholder="+3 / -2"
              inputMode="text"
              autoComplete="off"
              required
              className="input tabular-nums"
            />
          </div>
        </div>
        <div>
          <label htmlFor="pa-note" className="label mb-1.5 block">
            Notiz
          </label>
          <input
            id="pa-note"
            name="note"
            maxLength={200}
            placeholder="z. B. Tipp per WhatsApp vor Kickoff geschickt"
            autoComplete="off"
            className="input"
          />
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

        <Submit />
      </form>

      {adjustments.length === 0 ? (
        <p className="text-sm text-n1">Noch keine Korrekturen.</p>
      ) : (
        <ul className="border-t border-rule">
          {adjustments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule py-2"
            >
              <span
                data-numeric
                className={`w-12 shrink-0 text-right font-mono text-sm font-semibold ${
                  a.points > 0 ? "text-correct" : "text-wrong"
                }`}
              >
                {signed(a.points)}
              </span>
              <span className="text-sm font-medium">{a.username}</span>
              <span className="text-meta text-n1">{a.weekLabel}</span>
              {a.note && <span className="min-w-0 flex-1 text-meta text-n2">{a.note}</span>}
              <span className="ml-auto flex items-baseline gap-2">
                <span className="font-mono text-meta text-n2">{a.createdLabel}</span>
                <form action={deletePointAdjustmentAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className="px-2 py-1 text-meta text-n1 hover:text-wrong">
                    Entfernen
                  </button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
