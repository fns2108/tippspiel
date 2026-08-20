"use server";

import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function savePushSubscription(sub: PushSubscriptionInput): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false };

  await db
    .insert(pushSubscriptions)
    .values({
      endpoint: sub.endpoint,
      userId: user.id,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      // A browser can hand the same endpoint to a different account on a
      // shared device; re-point it rather than leaving it with the old owner.
      set: { userId: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });

  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, user.id)));
  return { ok: true };
}
