import { POSTSEASON, PRO_BOWL_WEEK, REGULAR, REGULAR_WEEKS } from "@/lib/espn/client";

/**
 * The app addresses weeks by a single ordinal 1..22 so URLs stay readable
 * (`/week/2026/19`) and so ordering, "next week", and season totals are plain
 * arithmetic. The Pro Bowl is not pickable and has no ordinal.
 *
 *   1..18  regular season      → "Woche 1" .. "Woche 18"
 *   19     postseason week 1   → "Wild Card"
 *   20     postseason week 2   → "Divisional"
 *   21     postseason week 3   → "Conference"
 *   22     postseason week 5   → "Super Bowl"
 */
export const FIRST_ORDINAL = 1;
export const LAST_ORDINAL = 22;

const POSTSEASON_ORDINALS = [
  { ordinal: 19, week: 1, label: "Wild Card", short: "WC" },
  { ordinal: 20, week: 2, label: "Divisional", short: "DIV" },
  { ordinal: 21, week: 3, label: "Conference", short: "CONF" },
  { ordinal: 22, week: 5, label: "Super Bowl", short: "SB" },
] as const;

export type WeekRef = {
  ordinal: number;
  seasonType: number;
  week: number;
  label: string;
  short: string;
  isPostseason: boolean;
};

export function weekRef(ordinal: number): WeekRef {
  if (ordinal >= FIRST_ORDINAL && ordinal <= REGULAR_WEEKS) {
    return {
      ordinal,
      seasonType: REGULAR,
      week: ordinal,
      label: `Woche ${ordinal}`,
      short: `W${ordinal}`,
      isPostseason: false,
    };
  }
  const post = POSTSEASON_ORDINALS.find((p) => p.ordinal === ordinal);
  if (!post) throw new Error(`No such week ordinal: ${ordinal}`);
  return {
    ordinal: post.ordinal,
    seasonType: POSTSEASON,
    week: post.week,
    label: post.label,
    short: post.short,
    isPostseason: true,
  };
}

export function allWeekRefs(): WeekRef[] {
  const regular = Array.from({ length: REGULAR_WEEKS }, (_, i) => weekRef(i + 1));
  return [...regular, ...POSTSEASON_ORDINALS.map((p) => weekRef(p.ordinal))];
}

/** Maps a raw (seasonType, week) pair back to an ordinal, or null if unpickable. */
export function toOrdinal(seasonType: number, week: number): number | null {
  if (seasonType === REGULAR) {
    return week >= 1 && week <= REGULAR_WEEKS ? week : null;
  }
  if (seasonType === POSTSEASON) {
    if (week === PRO_BOWL_WEEK) return null;
    return POSTSEASON_ORDINALS.find((p) => p.week === week)?.ordinal ?? null;
  }
  return null;
}

export function isValidOrdinal(n: number): boolean {
  return Number.isInteger(n) && n >= FIRST_ORDINAL && n <= LAST_ORDINAL;
}

/**
 * The NFL season year. A season labelled 2026 starts in September 2026 and
 * finishes with a Super Bowl in February 2027, so January and February belong
 * to the previous season year.
 */
export function currentSeason(now: Date = new Date()): number {
  const override = process.env.NFL_SEASON;
  if (override) {
    const n = Number(override);
    if (Number.isInteger(n)) return n;
  }
  const year = now.getUTCFullYear();
  // March (month 2) onward is the new season year; Jan/Feb still belong to the last one.
  return now.getUTCMonth() <= 1 ? year - 1 : year;
}
