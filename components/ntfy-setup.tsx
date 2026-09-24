"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  saveNtfyTopic,
  sendMyTestNotification,
  suggestTopic,
  type NotifyState,
} from "@/app/actions/notifications";
import { BellIcon } from "@/components/icons";

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary">
      {pending ? "Wird gespeichert…" : "Speichern"}
    </button>
  );
}

function Test() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-secondary">
      <BellIcon />
      {pending ? "Wird geschickt…" : "Test schicken"}
    </button>
  );
}

/**
 * Reminders through the ntfy app.
 *
 * The topic is generated rather than typed: it is the only thing protecting the
 * messages, so a memorable one would be a bad one. The instructions are on the
 * page rather than behind a link because this is the one setup step a member
 * has to do on a second device.
 */
export function NtfySetup({ topic, server }: { topic: string | null; server: string }) {
  const [value, setValue] = useState(topic ?? "");
  const [saveState, save] = useActionState<NotifyState, FormData>(saveNtfyTopic, {
    error: null,
    notice: null,
  });
  const [testState, test] = useActionState<NotifyState, FormData>(sendMyTestNotification, {
    error: null,
    notice: null,
  });

  const host = server.replace(/^https?:\/\//, "");
  const state = saveState.error || saveState.notice ? saveState : testState;

  return (
    <div className="space-y-3 border border-rule px-3 py-3">
      <div className="flex items-baseline gap-2">
        <span aria-hidden className={topic ? "text-ink" : "text-n2"}>
          <BellIcon />
        </span>
        <p className="text-sm font-medium">Pick-Erinnerungen</p>
      </div>

      <ol className="ml-4 list-decimal space-y-1 text-meta text-n1">
        <li>
          Die App <strong>ntfy</strong> installieren (App Store oder Play Store).
        </li>
        <li>Unten ein Topic erzeugen und speichern.</li>
        <li>
          In der App auf <strong>+</strong> tippen und genau dieses Topic abonnieren.
          {host !== "ntfy.sh" && <> Server: <span className="font-mono">{server}</span>.</>}
        </li>
      </ol>

      <form action={save} className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="ntfy-topic" className="label mb-1.5 block">
            Dein Topic
          </label>
          <input
            id="ntfy-topic"
            name="topic"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="leer lassen für keine Erinnerungen"
            autoComplete="off"
            spellCheck={false}
            className="input w-full font-mono text-meta"
          />
        </div>
        <button
          type="button"
          onClick={async () => setValue(await suggestTopic())}
          className="btn btn-secondary"
        >
          Erzeugen
        </button>
        <Save />
      </form>

      {state.error && (
        <p role="alert" className="text-meta text-wrong">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p role="status" className="text-meta text-correct">
          {state.notice}
        </p>
      )}

      {topic && (
        <form action={test}>
          <Test />
        </form>
      )}

      <p className="text-meta text-n2">
        Wer das Topic kennt, kann die Erinnerungen mitlesen. Behalt es für dich.
      </p>
    </div>
  );
}
