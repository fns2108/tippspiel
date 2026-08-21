import type { Metadata } from "next";
import Link from "next/link";
import { registerAction } from "@/app/actions/auth";
import { AuthForm, Field } from "@/components/auth-form";

export const metadata: Metadata = { title: "Konto anlegen" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  // An invite link can carry the key, so a phone user does not have to type it.
  const { key } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="border-b border-ink pb-3">
        <h1>Konto anlegen</h1>
      </div>

      <p className="text-sm text-n1">
        Diese Runde ist nur mit Einladung. Du brauchst einen Key von der Person, die sie betreibt.
      </p>

      <AuthForm action={registerAction} submitLabel="Konto anlegen">
        <Field
          label="Invite-Key"
          name="invite"
          autoFocus={!key}
          spellCheck={false}
          autoComplete="off"
          className={`font-mono uppercase tracking-[0.08em] ${key ? "" : ""}`}
          hint="Groß- und Kleinschreibung egal."
        />
        {key && <PrefilledKey value={key} />}
        <Field
          label="Name"
          name="username"
          autoComplete="username"
          autoFocus={Boolean(key)}
          spellCheck={false}
          hint="Diesen Namen sehen alle anderen in den Standings."
        />
        <Field
          label="Passwort"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="Mindestens 8 Zeichen."
        />
        <Field label="Passwort bestätigen" name="confirm" type="password" autoComplete="new-password" />
      </AuthForm>

      <p className="text-sm text-n1">
        Schon ein Konto?{" "}
        <Link href="/login" className="font-medium text-ink">
          Anmelden
        </Link>
      </p>
    </div>
  );
}

/** Fills the invite field from ?key= without making it read-only. */
function PrefilledKey({ value }: { value: string }) {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){var el=document.getElementById("f-invite");if(el&&!el.value)el.value=${JSON.stringify(
          value.toUpperCase(),
        )};})();`,
      }}
    />
  );
}
