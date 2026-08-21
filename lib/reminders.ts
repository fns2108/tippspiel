import "server-only";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/lib/db";
import { games, picks, pushSubscriptions, syncState, users } from "@/lib/db/schema";
import { countdown } from "@/lib/format";
import { currentSeason, weekRef } from "@/lib/nfl/season";
import { getCurrentWeekOrdinal } from "@/lib/queries";

const HORIZON_HOURS = 48;

export type ReminderReport = {
  configured: boolean;
  considered: number;
  sent: number;
  skipped: number;
  removed: number;
  errors: string[];
};

function configure(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

/**
 * One nudge per member per day, while they still have unpicked games that lock
 * within the next two days.
 *
 * Idempotent by design: it stamps a per-member, per-day key, so it is safe to
 * call on any cadence. Vercel's free plan allows one scheduled job a day, which
 * is what this is built around; pointing an external pinger at it more often
 * simply makes the timing tighter without sending anyone a second copy.
 */
export async function sendPickReminders(now: Date = new Date()): Promise<ReminderReport> {
  const report: ReminderReport = {
    configured: false,
    considered: 0,
    sent: 0,
    skipped: 0,
    removed: 0,
    errors: [],
  };

  if (!configure()) return report;
  report.configured = true;

  const season = currentSeason(now);
  const ordinal = await getCurrentWeekOrdinal(season);
  if (ordinal === null) return report;

  const ref = weekRef(ordinal);
  const horizon = new Date(now.getTime() + HORIZON_HOURS * 3_600_000);

  // Members with at least one game that is still open, locks soon, and has no
  // pick from them.
  const rows = await db
    .select({
      userId: users.id,
      username: users.username,
      open: sql<number>`count(*)::int`,
      firstLock: sql<Date>`min(${games.kickoff})`,
    })
    .from(users)
    .innerJoin(
      games,
      and(
        eq(games.season, season),
        eq(games.seasonType, ref.seasonType),
        eq(games.week, ref.week),
        gt(games.kickoff, now),
        lt(games.kickoff, horizon),
      ),
    )
    .leftJoin(picks, and(eq(picks.gameId, games.id), eq(picks.userId, users.id)))
    .where(isNull(picks.teamId))
    .groupBy(users.id, users.username);

  report.considered = rows.length;
  const day = now.toISOString().slice(0, 10);

  for (const row of rows) {
    const stampKey = `reminder:${row.userId}:${day}`;

    // Claim the day's slot first. If the insert finds an existing row, someone
    // (or an earlier call) already notified this member today.
    const claimed = await db
      .insert(syncState)
      .values({ key: stampKey, lastSyncedAt: now })
      .onConflictDoNothing()
      .returning({ key: syncState.key });

    if (claimed.length === 0) {
      report.skipped++;
      continue;
    }

    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, row.userId));

    if (subs.length === 0) {
      report.skipped++;
      continue;
    }

    const firstLock = new Date(row.firstLock);
    const payload = JSON.stringify({
      title: `${row.open} ${row.open === 1 ? "Spiel" : "Spiele"} noch offen`,
      body: `${ref.label} — erster Kickoff in ${countdown(firstLock, now)}.`,
      tag: `pickem-${ref.ordinal}`,
      url: "/picks",
    });

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        report.sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410 mean the browser threw the subscription away; stop storing it.
        if (status === 404 || status === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
          report.removed++;
        } else {
          report.errors.push(`${row.username}: ${status ?? "send failed"}`);
        }
      }
    }
  }

  return report;
}
