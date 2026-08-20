import type { Metadata } from "next";
import Link from "next/link";
import { registerAction } from "@/app/actions/auth";
import { AuthForm, Field } from "@/components/auth-form";

export const metadata: Metadata = { title: "Create an account" };

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
        <h1>Create an account</h1>
      </div>

      <p className="text-sm text-n1">
        This pool is invite-only. You need a key from whoever runs it.
      </p>

      <AuthForm action={registerAction} submitLabel="Create account">
        <Field
          label="Invite key"
          name="invite"
          autoFocus={!key}
          spellCheck={false}
          autoComplete="off"
          className={`font-mono uppercase tracking-[0.08em] ${key ? "" : ""}`}
          hint="Case does not matter."
        />
        {key && <PrefilledKey value={key} />}
        <Field
          label="Name"
          name="username"
          autoComplete="username"
          autoFocus={Boolean(key)}
          spellCheck={false}
          hint="This is what everyone else sees on the leaderboard."
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
        />
        <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" />
      </AuthForm>

      <p className="text-sm text-n1">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink">
          Sign in
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
