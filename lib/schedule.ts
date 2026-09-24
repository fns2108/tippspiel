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
 *   anything kicking off before its slot   09:00 that morning
 *
 * That last line is for the games the league plays outside American evenings:
 * a London game kicks off at 15:30 in Berlin, so the 17:00 slot would arrive
 * after it had started. Each game takes the latest slot that is still a clear
 * hour before it starts, which leaves the ordinary cases exactly where they
 * were and moves only the odd ones forward.
 *
 * Pure on purpose: the whole schedule can be checked without a database or a
 * clock, which is the only way to be sure a reminder lands before kickoff.
 */

export const MORNING_HOUR = 9;
export const WEEKDAY_HOUR = 19;
export const SUNDAY_EARLY_HOUR = 17;
export const SUNDAY_LATE_HOUR = 21;
/** How far ahead of kickoff a reminder still counts as useful. */
export const MIN_LEAD_MINUTES = 60;
/** The morning after the last game, for the week's picture. */
export const RECAP_HOUR = 7;

export type SlotKind = "evening-before" | "morning" | "weekday" | "sunday-early" | "sunday-late";

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

/**
 * The hours a game could be announced at, latest first.
 *
 * The window a Sunday game belongs to falls out of the lead-time rule rather
 * than being decided separately: the 21:00 slot is simply not an option for a
 * game that starts at 19:00, so it takes 17:00 instead.
 */
function candidateHours(kickoff: Date): { kind: SlotKind; hour: number }[] {
  return isNflSunday(kickoff)
    ? [
        { kind: "sunday-late", hour: SUNDAY_LATE_HOUR },
        { kind: "sunday-early", hour: SUNDAY_EARLY_HOUR },
        { kind: "morning", hour: MORNING_HOUR },
      ]
    : [
        { kind: "weekday", hour: WEEKDAY_HOUR },
        { kind: "sunday-early", hour: SUNDAY_EARLY_HOUR },
        { kind: "morning", hour: MORNING_HOUR },
      ];
}

const enoughLead = (at: Date, kickoff: Date) =>
  at.getTime() + MIN_LEAD_MINUTES * 60_000 <= kickoff.getTime();

/** The latest slot that still leaves a clear hour before kickoff. */
function slotFor(kickoff: Date, day: string, timeZone: string) {
  for (const option of candidateHours(kickoff)) {
    const at = zonedInstant(day, option.hour, timeZone);
    if (enoughLead(at, kickoff)) return { ...option, at, id: `${day}:${option.hour}` };
  }

  /**
   * Nothing on the day itself works, so the evening before does.
   *
   * This is where ESPN's not-yet-scheduled games land: a flexed game carries a
   * placeholder of midnight Eastern, which is the small hours in Germany. The
   * alternative — two hours before kickoff — would ring at four in the morning.
   */
  const evening = zonedInstant(
    zonedDateKey(new Date(kickoff.getTime() - 24 * 3_600_000), timeZone),
    WEEKDAY_HOUR,
    timeZone,
  );
  return { kind: "evening-before" as SlotKind, at: evening, id: `${day}:eve` };
}

/** Groups a week's games into the reminders they belong to, earliest first. */
export function planReminderSlots(games: ScheduledGame[], timeZone: string): ReminderSlot[] {
  const slots = new Map<string, ReminderSlot>();

  for (const game of games) {
    const day = nflDayKey(game.kickoff);
    const { kind, at, id } = slotFor(game.kickoff, day, timeZone);

    const slot = slots.get(id);
    if (slot) {
      slot.gameIds.push(game.id);
      if (game.kickoff < slot.firstKickoff) slot.firstKickoff = game.kickoff;
      continue;
    }

    slots.set(id, {
      id,
      kind,
      at,
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
