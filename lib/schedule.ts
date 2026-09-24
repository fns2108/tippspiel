import { isNflSunday, nflDayKey, nflDayLabel, nflHour, zonedDateKey, zonedInstant } from "@/lib/format";

/**
 * When reminders go out.
 *
 * The pool watches from Germany, so the times are German evenings, but the
 * grouping is the NFL's own day — a Monday nighter kicks off at 02:15 on
 * Tuesday in Berlin and is still a Monday game. Grouping by the German
 * calendar would file it under Tuesday and remind about it a day late.
 *
 *   any day but Sunday   19:00, for that day's games
 *   Sunday, early games  17:00
 *   Sunday, late games   21:00   (the afternoon window and the night game)
 *
 * Pure on purpose: the whole schedule can be checked without a database or a
 * clock, which is the only way to be sure a reminder lands before kickoff.
 */

export const WEEKDAY_HOUR = 19;
export const SUNDAY_EARLY_HOUR = 17;
export const SUNDAY_LATE_HOUR = 21;
/** The morning after the last game, for the week's picture. */
export const RECAP_HOUR = 7;

/** An ET kickoff before this hour is the early Sunday window. */
const SUNDAY_SPLIT_HOUR = 15;

export type SlotKind = "weekday" | "sunday-early" | "sunday-late";

export type ReminderSlot = {
  /** Stable across calls, so a sent reminder can be recorded against it. */
  id: string;
  kind: SlotKind;
  /** When the reminder is due. */
  at: Date;
  /** "Donnerstag", "Sonntag" — the NFL's day, in German. */
  dayLabel: string;
  gameIds: string[];
  /** The first kickoff in the slot, for the text. */
  firstKickoff: Date;
};

export type ScheduledGame = { id: string; kickoff: Date };

function slotHour(kickoff: Date): { kind: SlotKind; hour: number } {
  if (!isNflSunday(kickoff)) return { kind: "weekday", hour: WEEKDAY_HOUR };
  return nflHour(kickoff) < SUNDAY_SPLIT_HOUR
    ? { kind: "sunday-early", hour: SUNDAY_EARLY_HOUR }
    : { kind: "sunday-late", hour: SUNDAY_LATE_HOUR };
}

/** Groups a week's games into the reminders they belong to, earliest first. */
export function planReminderSlots(games: ScheduledGame[], timeZone: string): ReminderSlot[] {
  const slots = new Map<string, ReminderSlot>();

  for (const game of games) {
    const day = nflDayKey(game.kickoff);
    const { kind, hour } = slotHour(game.kickoff);
    const id = `${day}:${hour}`;

    const slot = slots.get(id);
    if (slot) {
      slot.gameIds.push(game.id);
      if (game.kickoff < slot.firstKickoff) slot.firstKickoff = game.kickoff;
      continue;
    }

    slots.set(id, {
      id,
      kind,
      at: zonedInstant(day, hour, timeZone),
      dayLabel: nflDayLabel(game.kickoff),
      gameIds: [game.id],
      firstKickoff: game.kickoff,
    });
  }

  return [...slots.values()].sort((a, b) => a.at.getTime() - b.at.getTime());
}

/**
 * The morning after the last game of the week.
 *
 * Measured from four hours past the last kickoff rather than from the kickoff
 * itself: a Sunday night game starts at 02:20 in Berlin and finishes on the
 * Monday, and "the next morning" means the morning after it ended.
 */
export function recapInstant(lastKickoff: Date, timeZone: string): Date {
  const finished = new Date(lastKickoff.getTime() + 4 * 3_600_000);
  return zonedInstant(zonedDateKey(finished, timeZone), RECAP_HOUR, timeZone);
}
