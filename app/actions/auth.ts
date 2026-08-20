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
    return { error: "Enter your name and password." };
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
      return { error: `Too many attempts. Try again ${describeRetry(gate.retryAfterMs)}.` };
    }
  }

  const user = await authenticate(username, password);
  if (!user) return { error: "That name and password do not match." };

  await clearAttempts(`login:user:${username.toLowerCase()}`);
  await createSession(user.id);
  redirect("/picks");
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const inviteCode = String(formData.get("invite") ?? "");

  if (!inviteCode) return { error: "You need an invite key to join." };
  if (password !== confirm) return { error: "The two passwords do not match." };

  // The invite key is the thing genuinely worth protecting: keys are short
  // enough to guess given unlimited tries.
  const ip = await clientIp();
  const gate = await consumeAttempt(`register:ip:${ip}`, 10, HOUR);
  if (!gate.allowed) {
    return { error: `Too many attempts. Try again ${describeRetry(gate.retryAfterMs)}.` };
  }

  let userId: string;
  try {
    const user = await registerUser({ username, password, inviteCode });
    userId = user.id;
  } catch (err) {
    if (err instanceof RegistrationError) return { error: err.message };
    console.error("[register]", err);
    return { error: "Something went wrong creating the account. Try again." };
  }

  await clearAttempts(`register:ip:${ip}`);
  await createSession(userId);
  redirect("/picks");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
