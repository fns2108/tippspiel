import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { syncWeekIfStale } from "@/lib/espn/sync";
import { LAST_ORDINAL, currentSeason } from "@/lib/nfl/season";
import { getCurrentWeekOrdinal } from "@/lib/queries";
import { sendPickReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Without a configured secret the endpoint stays shut rather than open.
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The one scheduled job.
 *
 * Vercel's free plan runs this daily. It refreshes the current week and the one
 * after it, then sends pick reminders. Everything here is idempotent and
 * safe to call more often — pointing a free external pinger at it during game
 * windows simply tightens score freshness.
 *
 * Nothing about correctness depends on this running: locking, reveal and
 * scoring are all derived from the clock at read time.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const season = currentSeason();
  const current = (await getCurrentWeekOrdinal(season)) ?? 1;

  const synced: number[] = [];
  for (const ordinal of [current, current + 1]) {
    if (ordinal < 1 || ordinal > LAST_ORDINAL) continue;
    const didFetch = await syncWeekIfStale(season, ordinal, { force: true });
    if (didFetch) synced.push(ordinal);
  }

  const reminders = await sendPickReminders();

  return NextResponse.json({ season, current, synced, reminders });
}
