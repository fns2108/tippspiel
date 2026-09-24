"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { generateNtfyTopic, normalizeNtfyTopic, sendNtfy } from "@/lib/ntfy";

export type NotifyState = { error: string | null; notice: string | null; topic?: string };

/** A fresh topic to paste into the ntfy app. Not saved until they submit. */
export async function suggestTopic(): Promise<string> {
  return generateNtfyTopic();
}

export async function saveNtfyTopic(
  _prev: NotifyState,
  formData: FormData,
): Promise<NotifyState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Du bist abgemeldet.", notice: null };

  const raw = String(formData.get("topic") ?? "");
  if (raw.trim() === "") {
    await db.update(users).set({ ntfyTopic: null }).where(eq(users.id, user.id));
    revalidatePath("/u/[username]", "page");
    return { error: null, notice: "Erinnerungen aus." };
  }

  const topic = normalizeNtfyTopic(raw);
  if (!topic) {
    return {
      error:
        "Das sieht nicht nach einem gültigen Topic aus. Erlaubt sind 12–64 Zeichen: " +
        "Buchstaben, Zahlen, Bindestrich und Unterstrich.",
      notice: null,
    };
  }

  await db.update(users).set({ ntfyTopic: topic }).where(eq(users.id, user.id));
  revalidatePath("/u/[username]", "page");
  return { error: null, notice: "Gespeichert. Schick dir am besten gleich einen Test." };
}

/** Sends the signed-in member a test notification to their own topic. */
export async function sendMyTestNotification(
  _prev: NotifyState,
  _formData: FormData,
): Promise<NotifyState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Du bist abgemeldet.", notice: null };

  const [row] = await db
    .select({ topic: users.ntfyTopic })
    .from(users)
    .where(eq(users.id, user.id));

  if (!row?.topic) {
    return { error: "Trag erst ein Topic ein und speichere es.", notice: null };
  }

  const result = await sendNtfy({
    topic: row.topic,
    title: "Test",
    message: "Erinnerungen funktionieren. Das war ein Test.",
    tags: ["white_check_mark"],
  });

  return result.ok
    ? { error: null, notice: "Test geschickt — die Nachricht sollte sofort ankommen." }
    : { error: `Versand fehlgeschlagen: ${result.error}`, notice: null };
}
