import "server-only";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { games, picks, syncState, users } from "@/lib/db/schema";
import { appUrl, ntfyServer, recapTitle, sendNtfy, sendNtfyFile, slotMessage } from "@/lib/ntfy";
import { SERVER_TZ, formatTime } from "@/lib/format";
import { planReminderSlots, recapInstant } from "@/lib/schedule";
import { loadShareCard } from "@/lib/share-card";
import { loadFonts, renderShareCard } from "@/lib/share-image";
import { getCurrentWeekOrdinal, getWeekGames } from "@/lib/queries";
import { currentSeason, weekRef } from "@/lib/nfl/season";

export type ReminderReport = {
  configured: boolean;
  /** Why not, when `configured` is false. */
  reason: string | null;
  /** Members with a topic, i.e. who could receive anything at all. */
  considered: number;
  sent: number;
  /** Already sent earlier, or nothing outstanding for them. */
  skipped: number;
  errors: string[];
};

/**
 * Sends whatever is due right now.
 *
 * The schedule lives in lib/schedule.ts and is expressed as "due at", so this
 * has no cadence of its own: call it hourly and each reminder goes out once,
 * within the hour it was due. Every message is claimed in `sync_state` before
 * it is sent, so a second call — or two overlapping ones — cannot repeat it,
 * and a missed hour only delays a reminder rather than losing it.
 */
export async function sendPickReminders(now: Date = new Date()): Promise<ReminderReport> {
  const report: ReminderReport = {
    configured: true,
    reason: null,
    considered: 0,
    sent: 0,
    skipped: 0,
    errors: [],
  };

  const season = currentSeason(now);
  const ordinal = await getCurrentWeekOrdinal(season);
  if (ordinal === null) return report;

  const ref = weekRef(ordinal);
  const site = appUrl();

  const [weekGames, members] = await Promise.all([
    getWeekGames(season, ordinal, now),
    db
      .select({ id: users.id, username: users.username, topic: users.ntfyTopic })
      .from(users)
      .where(isNotNull(users.ntfyTopic)),
  ]);

  report.considered = members.length;
  if (members.length === 0 || weekGames.length === 0) return report;

  const mine = await db
    .select({ userId: picks.userId, gameId: picks.gameId })
    .from(picks)
    .innerJoin(games, eq(games.id, picks.gameId))
    .where(
      and(
        eq(games.season, season),
        eq(games.seasonType, ref.seasonType),
        eq(games.week, ref.week),
      ),
    );
  const picked = new Set(mine.map((p) => `${p.userId}:${p.gameId}`));

  const kickoffById = new Map(weekGames.map((g) => [g.id, g.kickoff]));
  const matchup = new Map(
    weekGames.map((g) => [g.id, `${g.away.abbrev} ${g.neutralSite ? "vs" : "@"} ${g.home.abbrev}`]),
  );
  const slots = planReminderSlots(
    weekGames.map((g) => ({ id: g.id, kickoff: g.kickoff })),
    SERVER_TZ,
  );

  for (const slot of slots) {
    if (slot.at > now) continue;

    // A game that has already kicked off can no longer be picked, so it is not
    // worth reminding about even if the slot is only now being processed.
    const stillOpen = slot.gameIds.filter((id) => (kickoffById.get(id) ?? now) > now);
    if (stillOpen.length === 0) continue;

    for (const member of members) {
      const missing = stillOpen.filter((id) => !picked.has(`${member.id}:${id}`));
      if (missing.length === 0) continue;

      const claimed = await claim(`remind:${member.id}:${slot.id}`, now);
      if (!claimed) {
        report.skipped++;
        continue;
      }

      const result = await sendNtfy(
        slotMessage({
          topic: member.topic!,
          games: missing.map((id) => matchup.get(id) ?? "—"),
          appUrl: site,
        }),
      );

      if (result.ok) report.sent++;
      else report.errors.push(`${member.username}: ${result.error}`);
    }
  }

  await sendWeekRecap({ season, ordinal, now, members, weekGames, site, report });
  return report;
}

/**
 * Claims a one-off job. Returns false if someone already did it.
 *
 * The whole schedule is driven by "is it due yet", so every message would go
 * out again on the next ping without this.
 */
async function claim(key: string, now: Date): Promise<boolean> {
  const rows = await db
    .insert(syncState)
    .values({ key, lastSyncedAt: now })
    .onConflictDoNothing()
    .returning({ key: syncState.key });
  return rows.length > 0;
}

/** The week's picture, the morning after the last game. */
async function sendWeekRecap(input: {
  season: number;
  ordinal: number;
  now: Date;
  members: { id: string; username: string; topic: string | null }[];
  weekGames: { kickoff: Date; status: string }[];
  site: string | null;
  report: ReminderReport;
}): Promise<void> {
  const { season, ordinal, now, members, weekGames, site, report } = input;

  const complete = weekGames.length > 0 && weekGames.every((g) => g.status === "post");
  if (!complete) return;

  const last = weekGames.reduce((a, b) => (a.kickoff > b.kickoff ? a : b)).kickoff;
  if (recapInstant(last, SERVER_TZ) > now) return;

  // Drawn once and sent to everyone: rendering is the expensive part.
  const card = await loadShareCard(season, ordinal);
  const title = recapTitle(card.ref.label);
  const png = Buffer.from(await renderShareCard(card, await loadFonts()).arrayBuffer());

  for (const member of members) {
    const claimed = await claim(`recap:${season}:${ordinal}:${member.id}`, now);
    if (!claimed) {
      report.skipped++;
      continue;
    }

    const result = await sendNtfyFile({
      topic: member.topic!,
      bytes: png,
      filename: `tippspiel-woche-${ordinal}-${season}.png`,
      title,
      ...(site ? { click: `${site}/share/${ordinal}` } : {}),
    });

    if (result.ok) report.sent++;
    else report.errors.push(`${member.username}: ${result.error}`);
  }
}

export type TestReminderReport = {
  configured: boolean;
  reason: string | null;
  sent: number;
  errors: string[];
};

/**
 * Sends one notification to a single member, right now.
 *
 * Ignores both gates the real job depends on — the 48-hour horizon and the
 * once-a-day stamp — because those are what make the real job impossible to
 * test on demand. It writes no stamp, so a test never consumes the day's real
 * reminder.
 */
export async function sendTestReminder(userId: string): Promise<TestReminderReport> {
  const report: TestReminderReport = { configured: true, reason: null, sent: 0, errors: [] };

  const [row] = await db
    .select({ topic: users.ntfyTopic })
    .from(users)
    .where(eq(users.id, userId));

  if (!row?.topic) {
    report.configured = false;
    report.reason =
      "Für dich ist kein ntfy-Topic hinterlegt. Trag es auf deiner Profilseite ein.";
    return report;
  }

  const result = await sendNtfy({
    topic: row.topic,
    title: "Test",
    message: "Erinnerungen funktionieren. Das war ein Test.",
    tags: ["white_check_mark"],
    ...(process.env.APP_URL ? { click: `${process.env.APP_URL.replace(/\/+$/, "")}/picks` } : {}),
  });

  if (result.ok) report.sent++;
  else report.errors.push(result.error);

  return report;
}

/** What the real job would do right now, without doing it. */
export async function previewReminders(now: Date = new Date()): Promise<{
  configured: boolean;
  reason: string | null;
  server: string;
  season: number;
  ordinal: number | null;
  slots: { label: string; at: Date; games: number; open: boolean; due: boolean }[];
  members: { username: string; hasTopic: boolean }[];
}> {
  const season = currentSeason(now);
  const ordinal = await getCurrentWeekOrdinal(season);

  const members = await db
    .select({ username: users.username, hasTopic: sql<boolean>`${users.ntfyTopic} is not null` })
    .from(users)
    .orderBy(users.usernameLower);

  const anyTopics = members.some((m) => m.hasTopic);
  const base = {
    // ntfy needs no server-side keys; the only prerequisite is a subscriber.
    configured: anyTopics,
    reason: anyTopics
      ? null
      : "Noch niemand hat ein ntfy-Topic hinterlegt. Das geht auf der eigenen Profilseite.",
    server: ntfyServer(),
    season,
    ordinal,
    members,
  };
  if (ordinal === null) return { ...base, slots: [] };

  const weekGames = await getWeekGames(season, ordinal, now);
  const slots = planReminderSlots(
    weekGames.map((g) => ({ id: g.id, kickoff: g.kickoff })),
    SERVER_TZ,
  );
  const kickoffById = new Map(weekGames.map((g) => [g.id, g.kickoff]));

  return {
    ...base,
    slots: slots.map((slot) => ({
      label: `${slot.dayLabel}, ${formatTime(slot.at, SERVER_TZ)}`,
      at: slot.at,
      games: slot.gameIds.length,
      open: slot.gameIds.some((id) => (kickoffById.get(id) ?? now) > now),
      due: slot.at <= now,
    })),
  };
}
