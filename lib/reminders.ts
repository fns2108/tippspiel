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
  /** Why not, when `configured` is false. */
  reason: string | null;
  considered: number;
  sent: number;
  skipped: number;
  removed: number;
  errors: string[];
};

export type VapidStatus = { ok: boolean; reason: string | null };

/**
 * Checks the push configuration without ever throwing.
 *
 * `setVapidDetails` validates as it goes and throws on a malformed key or a
 * subject that is not a mailto/https url. Letting that escape is worse than it
 * sounds: thrown out of a server action it leaves the form with no state to
 * render, so the button looks dead, and thrown out of the cron route it takes
 * the whole scheduled run down with it. So it is caught here and turned into a
 * reason the interface can actually show.
 */
export function vapidStatus(): VapidStatus {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:admin@example.com";

  const missing = [
    publicKey ? null : "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
    privateKey ? null : "VAPID_PRIVATE_KEY",
  ].filter(Boolean);

  if (missing.length > 0) {
    return {
      ok: false,
      reason: `${missing.join(" und ")} ${missing.length === 1 ? "fehlt" : "fehlen"} in den Environment Variables.`,
    };
  }

  try {
    webpush.setVapidDetails(subject, publicKey!, privateKey!);
    return { ok: true, reason: null };
  } catch (err) {
    return {
      ok: false,
      reason: `VAPID-Konfiguration ungültig: ${(err as Error).message} (VAPID_SUBJECT ist "${subject}")`,
    };
  }
}

function configure(): boolean {
  return vapidStatus().ok;
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
  const status = vapidStatus();
  const report: ReminderReport = {
    configured: false,
    reason: status.reason,
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

export type TestReminderReport = {
  configured: boolean;
  reason: string | null;
  subscriptions: number;
  sent: number;
  removed: number;
  errors: string[];
};

/**
 * Sends one notification to a single member, right now.
 *
 * Deliberately ignores both gates the real job depends on — the 48-hour
 * horizon and the once-a-day stamp — because those are exactly what make the
 * real job impossible to test on demand: out of season nobody qualifies, and
 * in season it will only fire once per member per day.
 *
 * It touches nothing: no stamp is written, so a test can never consume the
 * day's real reminder, and running it twice sends twice.
 */
export async function sendTestReminder(userId: string): Promise<TestReminderReport> {
  const status = vapidStatus();
  const report: TestReminderReport = {
    configured: false,
    reason: status.reason,
    subscriptions: 0,
    sent: 0,
    removed: 0,
    errors: [],
  };

  if (!configure()) return report;
  report.configured = true;

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  report.subscriptions = subs.length;
  if (subs.length === 0) return report;

  const payload = JSON.stringify({
    title: "Test",
    body: "Erinnerungen funktionieren. Das war ein Test.",
    // A tag of its own, so a test never replaces a real reminder in the tray.
    tag: "pickem-test",
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
        report.errors.push(String(status ?? (err as Error).message));
      }
    }
  }

  return report;
}

/** What the real job would do right now, without doing it. */
export async function previewReminders(now: Date = new Date()): Promise<{
  configured: boolean;
  reason: string | null;
  season: number;
  ordinal: number | null;
  horizonHours: number;
  dueSoon: number;
  members: { username: string; open: number; subscriptions: number; alreadyToday: boolean }[];
}> {
  const season = currentSeason(now);
  const ordinal = await getCurrentWeekOrdinal(season);
  const status = vapidStatus();
  const base = {
    configured: status.ok,
    reason: status.reason,
    season,
    ordinal,
    horizonHours: HORIZON_HOURS,
  };
  if (ordinal === null) return { ...base, dueSoon: 0, members: [] };

  const ref = weekRef(ordinal);
  const horizon = new Date(now.getTime() + HORIZON_HOURS * 3_600_000);

  const [{ dueSoon }] = await db
    .select({ dueSoon: sql<number>`count(*)::int` })
    .from(games)
    .where(
      and(
        eq(games.season, season),
        eq(games.seasonType, ref.seasonType),
        eq(games.week, ref.week),
        gt(games.kickoff, now),
        lt(games.kickoff, horizon),
      ),
    );

  const day = now.toISOString().slice(0, 10);
  const rows = await db
    .select({
      username: users.username,
      // count(games.id), not count(*): with no games in the horizon the left
      // join still yields one row per member, and count(*) would call that 1.
      open: sql<number>`count(${games.id}) filter (where ${picks.teamId} is null)::int`,
      subscriptions: sql<number>`(select count(*)::int from ${pushSubscriptions} s where s.user_id = ${users.id})`,
      alreadyToday: sql<boolean>`exists (select 1 from ${syncState} st where st.key = 'reminder:' || ${users.id} || ':' || ${day})`,
    })
    .from(users)
    .leftJoin(
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
    .groupBy(users.id, users.username);

  return { ...base, dueSoon, members: rows };
}
