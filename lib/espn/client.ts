/**
 * The only place that knows ESPN's shape.
 *
 * This is a public but undocumented API. Everything it returns is treated as
 * untrusted and optional: any field can vanish without notice, and the
 * normalizers below degrade rather than throw. If ESPN ever breaks for good,
 * this file is what gets rewritten — nothing above it knows the difference.
 */

/**
 * `site.web.api.espn.com`, not the more obvious `site.api.espn.com`.
 *
 * They serve the same paths and the same payload shape, but `site.api` began
 * returning 403 to every caller — any User-Agent, with or without a Referer,
 * from a residential address as readily as from a datacenter. `site.web.api`
 * is the host espn.com's own pages call and it still answers normally.
 *
 * If this one starts refusing too, check `cdn.espn.com/core/nfl/schedule?xhr=1`
 * before assuming the whole feed is gone.
 */
const SITE_API = "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl";

/** ESPN's `seasontype`. */
export const REGULAR = 2;
export const POSTSEASON = 3;

/**
 * ESPN files the Pro Bowl as postseason week 4. It is not a pickable game, so
 * it never enters the database.
 */
export const PRO_BOWL_WEEK = 4;

export const REGULAR_WEEKS = 18;

export type NormalizedTeam = {
  id: string;
  abbrev: string;
  location: string;
  name: string;
  displayName: string;
  color: string | null;
  altColor: string | null;
  logoLight: string | null;
  logoDark: string | null;
};

export type NormalizedGame = {
  id: string;
  season: number;
  seasonType: number;
  week: number;
  kickoff: Date;
  homeTeamId: string;
  awayTeamId: string;
  neutralSite: boolean;
  status: "pre" | "in" | "post";
  statusDetail: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamId: string | null;
  isTie: boolean;
  /** Home-relative: negative means the home team is favored. Null when absent. */
  spread: number | null;
  spreadDetail: string | null;
  overUnder: number | null;
};

class EspnError extends Error {}

async function get(path: string): Promise<unknown> {
  const url = `${SITE_API}${path}`;
  const res = await fetch(url, {
    headers: {
      // ESPN serves a bot-flavoured response to a bare fetch UA often enough
      // to be worth setting explicitly.
      "User-Agent": "nfl-pickem/1.0 (private pool; contact via site admin)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
    // Freshness is governed by sync_state in our own database, not by fetch cache.
    cache: "no-store",
  });

  if (!res.ok) throw new EspnError(`ESPN ${res.status} ${res.statusText} for ${path}`);
  return res.json();
}

/* ------------------------------------------------------------- helpers */

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const str = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

function logoByRel(logos: unknown, wantDark: boolean): string | null {
  for (const entry of asArray(logos)) {
    const l = asRecord(entry);
    const rel = asArray(l.rel).filter((r): r is string => typeof r === "string");
    const isDark = rel.includes("dark");
    // Prefer the plain full logo over the scoreboard crop.
    if (rel.includes("full") && !rel.includes("scoreboard") && isDark === wantDark) {
      return str(l.href);
    }
  }
  return null;
}

/* --------------------------------------------------------------- teams */

export async function fetchTeams(): Promise<NormalizedTeam[]> {
  const data = asRecord(await get("/teams?limit=40"));
  const sports = asArray(data.sports);
  const leagues = asArray(asRecord(sports[0]).leagues);
  const entries = asArray(asRecord(leagues[0]).teams);

  const out: NormalizedTeam[] = [];
  for (const entry of entries) {
    const t = asRecord(asRecord(entry).team);
    const id = str(t.id);
    const abbrev = str(t.abbreviation);
    if (!id || !abbrev) continue;

    out.push({
      id,
      abbrev,
      location: str(t.location) ?? abbrev,
      name: str(t.name) ?? abbrev,
      displayName: str(t.displayName) ?? abbrev,
      color: str(t.color),
      altColor: str(t.alternateColor),
      logoLight: logoByRel(t.logos, false),
      logoDark: logoByRel(t.logos, true),
    });
  }
  return out;
}

/* -------------------------------------------------------------- games */

function normalizeStatus(state: string | null): "pre" | "in" | "post" {
  if (state === "in") return "in";
  if (state === "post") return "post";
  return "pre";
}

/**
 * ESPN reports `odds[].spread` relative to the HOME team, but only some
 * providers populate it. `homeTeamOdds.favorite` is the cross-check: when the
 * sign disagrees with who the feed calls the favorite, the sign is corrected.
 */
function normalizeOdds(competition: Record<string, unknown>, homeTeamId: string) {
  const candidates = asArray(competition.odds)
    .map(asRecord)
    .filter((o) => num(o.spread) !== null);

  if (candidates.length === 0) {
    return { spread: null, spreadDetail: null, overUnder: null };
  }

  // Lowest provider priority number wins (ESPN orders its preferred book first).
  candidates.sort((a, b) => {
    const pa = num(asRecord(a.provider).priority) ?? 99;
    const pb = num(asRecord(b.provider).priority) ?? 99;
    return pa - pb;
  });

  const odds = candidates[0];
  let spread = num(odds.spread);
  const homeOdds = asRecord(odds.homeTeamOdds);
  const homeIsFavorite = homeOdds.favorite;

  if (spread !== null && typeof homeIsFavorite === "boolean" && spread !== 0) {
    const signSaysHomeFavored = spread < 0;
    if (signSaysHomeFavored !== homeIsFavorite) spread = -spread;
  }

  // Guard against a stray team-id mismatch in the payload.
  const oddsHomeId = str(asRecord(homeOdds.team).id);
  if (oddsHomeId && oddsHomeId !== homeTeamId && spread !== null) spread = -spread;

  return {
    spread,
    spreadDetail: str(odds.details),
    overUnder: num(odds.overUnder),
  };
}

function normalizeEvent(
  event: Record<string, unknown>,
  season: number,
  seasonType: number,
  week: number,
): NormalizedGame | null {
  const id = str(event.id);
  const dateRaw = str(event.date);
  if (!id || !dateRaw) return null;

  const kickoff = new Date(dateRaw);
  if (Number.isNaN(kickoff.getTime())) return null;

  const competition = asRecord(asArray(event.competitions)[0]);
  const competitors = asArray(competition.competitors).map(asRecord);

  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  const homeTeamId = str(asRecord(home?.team).id);
  const awayTeamId = str(asRecord(away?.team).id);
  if (!home || !away || !homeTeamId || !awayTeamId) return null;

  const statusType = asRecord(asRecord(competition.status).type);
  const status = normalizeStatus(str(statusType.state));

  const homeScore = num(home.score);
  const awayScore = num(away.score);

  let winnerTeamId: string | null = null;
  let isTie = false;
  if (status === "post" && homeScore !== null && awayScore !== null) {
    if (homeScore > awayScore) winnerTeamId = homeTeamId;
    else if (awayScore > homeScore) winnerTeamId = awayTeamId;
    else isTie = true;
  }

  return {
    id,
    season,
    seasonType,
    week,
    kickoff,
    homeTeamId,
    awayTeamId,
    neutralSite: competition.neutralSite === true,
    status,
    statusDetail: str(statusType.shortDetail) ?? str(statusType.description),
    homeScore: status === "pre" ? null : homeScore,
    awayScore: status === "pre" ? null : awayScore,
    winnerTeamId,
    isTie,
    ...normalizeOdds(competition, homeTeamId),
  };
}

export async function fetchWeek(
  season: number,
  seasonType: number,
  week: number,
): Promise<NormalizedGame[]> {
  const data = asRecord(
    await get(`/scoreboard?dates=${season}&seasontype=${seasonType}&week=${week}&limit=100`),
  );

  const out: NormalizedGame[] = [];
  for (const raw of asArray(data.events)) {
    const game = normalizeEvent(asRecord(raw), season, seasonType, week);
    if (game) out.push(game);
  }
  // ESPN mostly returns kickoff order already, but not always.
  out.sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());
  return out;
}

export { EspnError };
