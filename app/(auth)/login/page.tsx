import type { Metadata } from "next";
import Link from "next/link";
import { loginAction } from "@/app/actions/auth";
import { AuthForm, Field } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-ink pb-3">
        <h1>Sign in</h1>
      </div>

      <AuthForm action={loginAction} submitLabel="Sign in">
        <Field
          label="Name"
          name="username"
          autoComplete="username"
          autoFocus
          spellCheck={false}
        />
        <Field label="Password" name="password" type="password" autoComplete="current-password" />
      </AuthForm>

      <p className="text-sm text-n1">
        Got an invite key?{" "}
        <Link href="/register" className="font-medium text-ink">
          Create an account
        </Link>
      </p>
    </div>
  );
}
