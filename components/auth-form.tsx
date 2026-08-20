"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertIcon } from "@/components/icons";
import type { FormState } from "@/app/actions/auth";

export function Field({
  label,
  name,
  type = "text",
  hint,
  autoComplete,
  autoFocus,
  required = true,
  inputMode,
  spellCheck,
  className,
}: {
  label: string;
  name: string;
  type?: string;
  hint?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  required?: boolean;
  inputMode?: "text" | "numeric";
  spellCheck?: boolean;
  className?: string;
}) {
  const id = `f-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="label mb-1.5 block">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        inputMode={inputMode}
        spellCheck={spellCheck}
        aria-describedby={hintId}
        className={`input ${className ?? ""}`}
      />
      {hint && (
        <p id={hintId} className="mt-1.5 text-meta text-n1">
          {hint}
        </p>
      )}
    </div>
  );
}

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary w-full">
      {pending ? "Working…" : children}
    </button>
  );
}

export function AuthForm({
  action,
  submitLabel,
  children,
}: {
  action: (prev: FormState, data: FormData) => Promise<FormState>;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="space-y-4">
      {children}
      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 border border-wrong bg-wrong-soft px-3 py-2.5 text-sm text-wrong"
        >
          <span aria-hidden className="mt-0.5 shrink-0">
            <AlertIcon />
          </span>
          {state.error}
        </p>
      )}
      <Submit>{submitLabel}</Submit>
    </form>
  );
}
