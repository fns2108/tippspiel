/**
 * Time handling has a wrinkle specific to watching the NFL from Europe.
 *
 * A "Monday night" game kicks off at 02:15 on Tuesday in Berlin. Grouping games
 * by the viewer's local calendar day would split the Sunday slate across two
 * headings and file the Monday nighter under Tuesday — so games are grouped by
 * the NFL's own day (US Eastern), while the clock always shows local time.
 */

const NFL_TZ = "America/New_York";

/** Fallback timezone used for the server render, before the client reports its own. */
export const SERVER_TZ = process.env.DISPLAY_TZ || "Europe/Berlin";

const DAY_LABELS: Record<string, string> = {
  Mon: "Montag",
  Tue: "Dienstag",
  Wed: "Mittwoch",
  Thu: "Donnerstag",
  Fri: "Freitag",
  Sat: "Samstag",
  Sun: "Sonntag",
};

const easternParts = (d: Date) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: NFL_TZ,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});

/** Stable key for grouping a week's games into their NFL days. */
export function nflDayKey(kickoff: Date): string {
  const p = easternParts(kickoff);
  return `${p.year}-${p.month}-${p.day}`;
}

/** "Sonntag", "Montag" — the NFL's day, not the viewer's. */
export function nflDayLabel(kickoff: Date): string {
  return DAY_LABELS[easternParts(kickoff).weekday] ?? easternParts(kickoff).weekday;
}

const DAY_SHORT: Record<string, string> = {
  Mon: "MO",
  Tue: "DI",
  Wed: "MI",
  Thu: "DO",
  Fri: "FR",
  Sat: "SA",
  Sun: "SO",
};

export function nflDayShort(kickoff: Date): string {
  const weekday = easternParts(kickoff).weekday;
  return DAY_SHORT[weekday] ?? weekday.toUpperCase();
}

/** The hour of kickoff on the NFL's own clock, 0..23 — used to tell the
 * Sunday windows apart. */
export function nflHour(kickoff: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: NFL_TZ,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(kickoff),
  );
}

/** True for a game the NFL calls a Sunday game, whatever the German date is. */
export function isNflSunday(kickoff: Date): boolean {
  return easternParts(kickoff).weekday === "Sun";
}

function zoneOffsetMs(at: Date, timeZone: string): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(at)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - at.getTime();
}

/**
 * The instant at which a given wall clock time happens in a time zone.
 *
 * "19:00 in Berlin" is a different moment in summer and winter, and reminders
 * are specified in local evenings rather than in UTC. The offset is read at the
 * guessed instant and then subtracted, which is correct except inside the one
 * hour a year that the clocks skip — and nothing here is scheduled at 02:00.
 */
export function zonedInstant(dateKey: string, hour: number, timeZone: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const guess = Date.UTC(year!, month! - 1, day!, hour);
  return new Date(guess - zoneOffsetMs(new Date(guess), timeZone));
}

/** The calendar date in a zone, as the "YYYY-MM-DD" key the schedule uses. */
export function zonedDateKey(at: Date, timeZone: string): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
  return p;
}

/** Calendar date without a weekday — for "member since", not for kickoffs. */
export function formatDate(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatTime(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatDayAndTime(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** A signed spread rendered the way a sportsbook writes it. */
export function formatSpread(spread: number): string {
  if (spread === 0) return "PK";
  const rounded = Math.round(Math.abs(spread) * 2) / 2;
  const body = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${spread < 0 ? "−" : "+"}${body}`;
}

/**
 * Which side the line favours, and by how much, as plain words.
 * `spread` is home-relative: negative means the home team is favoured.
 */
export function describeLine(
  spread: number | null,
  home: { abbrev: string },
  away: { abbrev: string },
): string | null {
  if (spread === null) return null;
  if (spread === 0) return "Pick 'em — kein Favorit";
  const fav = spread < 0 ? home.abbrev : away.abbrev;
  const by = Math.abs(spread);
  return `${fav} favorisiert mit ${Number.isInteger(by) ? by : by.toFixed(1)}`;
}

export function pct(n: number, d: number): string {
  if (d === 0) return "—";
  return (n / d).toFixed(3).replace(/^0/, "");
}

/** Compact countdown: "4 Std 12 Min", "38 Min", "3 Tage". */
export function countdown(target: Date, now: Date = new Date()): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "jetzt";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} Min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} Std ${minutes % 60} Min`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 Tag" : `${days} Tage`;
}
