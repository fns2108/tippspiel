"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { sendTestReminderAction, type AdminState } from "@/app/actions/admin";
import { BellIcon } from "@/components/icons";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-secondary">
      <BellIcon />
      {pending ? "Wird geschickt…" : "Test an mich schicken"}
    </button>
  );
}

export function ReminderTest() {
  const [state, action] = useActionState<AdminState, FormData>(sendTestReminderAction, {
    error: null,
    notice: null,
  });

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <Submit />
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
