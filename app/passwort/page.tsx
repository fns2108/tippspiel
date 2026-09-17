import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChangePasswordView } from "@/components/change-password-view";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Neues Passwort" };

/**
 * Where a member lands after signing in with a temporary password.
 *
 * Deliberately outside both route groups: (auth) sends signed-in users away and
 * (app) sends flagged users here, so living in either would loop. It borrows
 * the auth pages' look instead — this is a form, not part of the app yet.
 */
export default async function ChangePasswordPage() {
  const user = await requireUser();
  if (!user.mustChangePassword) redirect("/picks");
  return <ChangePasswordView username={user.username} />;
}
