"use server";

import { redirect } from "next/navigation";
import {
  RegistrationError,
  authenticate,
  createSession,
  destroySession,
  registerUser,
} from "@/lib/auth";
import { clearAttempts, clientIp, consumeAttempt, describeRetry } from "@/lib/rate-limit";

export type FormState = { error: string | null };

const HOUR = 3_600_000;

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Gib deinen Namen und dein Passwort ein." };
  }

  // Throttle per account and per address, so neither a single target nor a
  // spray across names gets unlimited attempts.
  const ip = await clientIp();
  for (const [key, limit, window] of [
    [`login:user:${username.toLowerCase()}`, 10, HOUR],
    [`login:ip:${ip}`, 30, HOUR],
  ] as const) {
    const gate = await consumeAttempt(key, limit, window);
    if (!gate.allowed) {
      return { error: `Zu viele Versuche. Versuche es ${describeRetry(gate.retryAfterMs)} erneut.` };
    }
  }

  const user = await authenticate(username, password);
  if (!user) return { error: "Name und Passwort passen nicht zusammen." };

  await clearAttempts(`login:user:${username.toLowerCase()}`);
  await createSession(user.id);
  redirect("/picks");
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const inviteCode = String(formData.get("invite") ?? "");

  if (!inviteCode) return { error: "Du brauchst einen Invite-Key, um mitzumachen." };
  if (password !== confirm) return { error: "Die beiden Passwörter stimmen nicht überein." };

  // The invite key is the thing genuinely worth protecting: keys are short
  // enough to guess given unlimited tries.
  const ip = await clientIp();
  const gate = await consumeAttempt(`register:ip:${ip}`, 10, HOUR);
  if (!gate.allowed) {
    return { error: `Zu viele Versuche. Versuche es ${describeRetry(gate.retryAfterMs)} erneut.` };
  }

  let userId: string;
  try {
    const user = await registerUser({ username, password, inviteCode });
    userId = user.id;
  } catch (err) {
    if (err instanceof RegistrationError) return { error: err.message };
    console.error("[register]", err);
    return { error: "Beim Anlegen des Kontos ist etwas schiefgegangen. Versuch es nochmal." };
  }

  await clearAttempts(`register:ip:${ip}`);
  await createSession(userId);
  redirect("/picks");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
