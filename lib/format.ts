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
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
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

/** "Sunday", "Monday" — the NFL's day, not the viewer's. */
export function nflDayLabel(kickoff: Date): string {
  return DAY_LABELS[easternParts(kickoff).weekday] ?? easternParts(kickoff).weekday;
}

export function nflDayShort(kickoff: Date): string {
  return easternParts(kickoff).weekday.toUpperCase();
}

export function formatTime(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatDayAndTime(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
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
  if (spread === 0) return "Pick 'em — no favourite";
  const fav = spread < 0 ? home.abbrev : away.abbrev;
  const by = Math.abs(spread);
  return `${fav} favoured by ${Number.isInteger(by) ? by : by.toFixed(1)}`;
}

export function pct(n: number, d: number): string {
  if (d === 0) return "—";
  return (n / d).toFixed(3).replace(/^0/, "");
}

/** Compact countdown: "4h 12m", "38m", "in 3 days". */
export function countdown(target: Date, now: Date = new Date()): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day" : `${days} days`;
}
