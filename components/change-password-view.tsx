import { changePasswordAction, logoutAction } from "@/app/actions/auth";
import { AuthForm, Field } from "@/components/auth-form";
import { LogoutIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";

/** The /passwort page body, split out so it renders without a live session. */
export function ChangePasswordView({ username }: { username: string }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule">
        <div className="shell flex h-14 items-center gap-1">
          <span className="text-md font-semibold tracking-[-0.03em]">Tippspiel Wedel</span>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            {/* The only way out that is not "choose a password" — someone who
                signed in on the wrong account must not be stuck here. */}
            <form action={logoutAction}>
              <button
                type="submit"
                title="Abmelden"
                aria-label="Abmelden"
                className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] text-n1 transition-colors duration-150 hover:bg-sunken hover:text-ink"
              >
                <LogoutIcon />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="shell">
        <div className="mx-auto max-w-[26rem] space-y-6 pb-16 pt-12 md:pt-20">
          <div className="border-b border-ink pb-3">
            <h1>Neues Passwort</h1>
          </div>

          <p className="text-sm text-n1">
            Hallo {username} — du bist mit einem temporären Passwort angemeldet. Wähl jetzt
            ein eigenes, dann geht es weiter.
          </p>

          <AuthForm action={changePasswordAction} submitLabel="Passwort speichern">
            <Field
              label="Temporäres Passwort"
              name="current"
              type="password"
              autoComplete="current-password"
              autoFocus
            />
            <Field
              label="Neues Passwort"
              name="password"
              type="password"
              autoComplete="new-password"
              hint="Mindestens 8 Zeichen."
            />
            <Field
              label="Neues Passwort bestätigen"
              name="confirm"
              type="password"
              autoComplete="new-password"
            />
          </AuthForm>
        </div>
      </main>
    </div>
  );
}
