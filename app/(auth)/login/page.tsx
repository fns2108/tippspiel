import type { Metadata } from "next";
import Link from "next/link";
import { loginAction } from "@/app/actions/auth";
import { AuthForm, Field } from "@/components/auth-form";

export const metadata: Metadata = { title: "Anmelden" };

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-ink pb-3">
        <h1>Anmelden</h1>
      </div>

      <AuthForm action={loginAction} submitLabel="Anmelden">
        <Field
          label="Name"
          name="username"
          autoComplete="username"
          autoFocus
          spellCheck={false}
        />
        <Field label="Passwort" name="password" type="password" autoComplete="current-password" />
      </AuthForm>

      <p className="text-sm text-n1">
        Invite-Key bekommen?{" "}
        <Link href="/register" className="font-medium text-ink">
          Konto anlegen
        </Link>
      </p>
    </div>
  );
}
