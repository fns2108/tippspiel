"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { sendTestReminderAction, type AdminState } from "@/app/actions/admin";
import { BellIcon } from "@/components/icons";

/** Every kind of message the pool sends, so each can be checked on a phone. */
const KINDS: { kind: string; label: string }[] = [
  { kind: "plain", label: "Test" },
  { kind: "weekday", label: "Wochentag" },
  { kind: "sunday-early", label: "Sonntag früh" },
  { kind: "sunday-late", label: "Sonntag spät" },
  { kind: "recap", label: "Wochenbild" },
];

function Send({ kind, label }: { kind: string; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="kind"
      value={kind}
      disabled={pending}
      className="btn btn-secondary"
    >
      {kind === "plain" && <BellIcon />}
      {label}
    </button>
  );
}

export function ReminderTest() {
  const [state, action] = useActionState<AdminState, FormData>(sendTestReminderAction, {
    error: null,
    notice: null,
  });

  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {KINDS.map((k) => (
          <Send key={k.kind} kind={k.kind} label={k.label} />
        ))}
      </div>
      {state.error && (
        <p role="alert" className="max-w-[52ch] text-meta text-wrong">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p role="status" className="text-meta text-correct">
          {state.notice}
        </p>
      )}
    </form>
  );
}
