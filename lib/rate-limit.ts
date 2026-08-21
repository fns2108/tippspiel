import "server-only";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { authAttempts } from "@/lib/db/schema";

/**
 * Fixed-window counter in Postgres. The invite-key flow is the thing actually
 * worth protecting: keys are short enough to guess if you get unlimited tries.
 */
export async function consumeAttempt(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; retryAfterMs: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  /**
   * Timestamps interpolated into a raw `sql` template must be ISO strings with
   * an explicit cast, never Date objects.
   *
   * A Date assigned to a column (`values({ windowStart: now })`) is converted by
   * drizzle's column mapper. A Date interpolated into `sql` has no column, so no
   * mapper runs and the raw object reaches the driver — and drizzle's postgres-js
   * driver replaces postgres.js's timestamp serializers with `(val) => val`,
   * expecting to have done the conversion itself. The Date then lands in
   * Buffer.byteLength, which throws ERR_INVALID_ARG_TYPE on the first login.
   */
  const nowSql = now.toISOString();
  const windowStartSql = windowStart.toISOString();

  const [row] = await db
    .insert(authAttempts)
    .values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: authAttempts.key,
      set: {
        // Expired window resets; live window increments.
        count: sql`case when ${authAttempts.windowStart} < ${windowStartSql}::timestamptz then 1 else ${authAttempts.count} + 1 end`,
        windowStart: sql`case when ${authAttempts.windowStart} < ${windowStartSql}::timestamptz then ${nowSql}::timestamptz else ${authAttempts.windowStart} end`,
      },
    })
    .returning({ count: authAttempts.count, windowStart: authAttempts.windowStart });

  const elapsed = now.getTime() - row.windowStart.getTime();
  return {
    allowed: row.count <= limit,
    remaining: Math.max(0, limit - row.count),
    retryAfterMs: Math.max(0, windowMs - elapsed),
  };
}

export async function clearAttempts(key: string): Promise<void> {
  await db
    .insert(authAttempts)
    .values({ key, count: 0, windowStart: new Date() })
    .onConflictDoUpdate({
      target: authAttempts.key,
      set: { count: 0, windowStart: new Date() },
    });
}

/** Best-effort client IP. Vercel sets x-forwarded-for; local dev has none. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "local";
}

export function describeRetry(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes <= 1) return "in etwa einer Minute";
  if (minutes < 60) return `in etwa ${minutes} Minuten`;
  return `in etwa ${Math.ceil(minutes / 60)} Stunden`;
}
