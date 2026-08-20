"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createInviteKeyAction, type AdminState } from "@/app/actions/admin";
import { CheckIcon, CopyIcon, PlusIcon } from "@/components/icons";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary">
      <PlusIcon />
      {pending ? "Creating…" : "Create key"}
    </button>
  );
}

export function InviteKeyForm() {
  const [state, action] = useActionState<AdminState, FormData>(createInviteKeyAction, {
    error: null,
    notice: null,
  });

  return (
    <form action={action} className="space-y-3 border border-rule px-3 py-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div>
          <label htmlFor="k-label" className="label mb-1.5 block">
            Label
          </label>
          <input
            id="k-label"
            name="label"
            className="input"
            placeholder="for Jonas"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="k-uses" className="label mb-1.5 block">
            Uses
          </label>
          <input
            id="k-uses"
            name="maxUses"
            type="number"
            min={1}
            max={100}
            defaultValue={1}
            inputMode="numeric"
            className="input w-24 tabular-nums"
          />
        </div>
        <div>
          <label htmlFor="k-expiry" className="label mb-1.5 block">
            Expires
          </label>
          <select id="k-expiry" name="expiresInDays" defaultValue="0" className="input w-32">
            <option value="0">Never</option>
            <option value="1">In 1 day</option>
            <option value="7">In 7 days</option>
            <option value="30">In 30 days</option>
          </select>
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

      <Submit />
    </form>
  );
}

/** Copies the full invite link, which is what actually gets sent to someone. */
export function CopyKey({ code, origin }: { code: string; origin: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      title="Copy invite link"
      aria-label={`Copy invite link for ${code}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`${origin}/register?key=${code}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard unavailable — the code is on screen to copy by hand */
        }
      }}
      className="inline-flex h-7 w-7 items-center justify-center rounded-[3px] text-n1 transition-colors duration-150 hover:bg-sunken hover:text-ink"
    >
      {copied ? <CheckIcon className="text-correct" /> : <CopyIcon />}
    </button>
  );
}
