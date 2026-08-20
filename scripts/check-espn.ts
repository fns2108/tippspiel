/**
 * Smoke-tests the upstream feed without touching the database.
 *
 *   npm run check:espn
 *
 * Run this first whenever scores or lines look wrong — it separates "ESPN
 * changed something" from "our code is broken".
 */
import { POSTSEASON, REGULAR, fetchTeams, fetchWeek } from "../lib/espn/client.ts";
import { currentSeason, toOrdinal, weekRef } from "../lib/nfl/season.ts";

let failures = 0;
const check = (ok: boolean, label: string, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
};

const season = currentSeason();
console.log(`current season: ${season}\n`);

/* teams */
const teams = await fetchTeams();
check(teams.length === 32, "32 teams", `got ${teams.length}`);
const noLogo = teams.filter((t) => !t.logoLight || !t.logoDark);
check(noLogo.length === 0, "every team has light + dark logos", noLogo.map((t) => t.abbrev).join(","));
const noColor = teams.filter((t) => !t.color);
check(noColor.length === 0, "every team has a primary colour", noColor.map((t) => t.abbrev).join(","));

/* week ordinals */
check(toOrdinal(REGULAR, 5) === 5, "regular week 5 → ordinal 5");
check(toOrdinal(POSTSEASON, 1) === 19, "wild card → ordinal 19");
check(toOrdinal(POSTSEASON, 4) === null, "pro bowl is excluded");
check(toOrdinal(POSTSEASON, 5) === 22, "super bowl → ordinal 22");
check(weekRef(22).label === "Super Bowl", "ordinal 22 labels as Super Bowl");

/* upcoming week: schedule + lines */
const w1 = await fetchWeek(season, REGULAR, 1);
check(w1.length >= 13, `week 1 has a full slate`, `${w1.length} games`);
check(
  w1.every((g) => g.homeTeamId !== g.awayTeamId && g.kickoff instanceof Date),
  "every game has two distinct teams and a kickoff",
);

const byId = new Map(teams.map((t) => [t.id, t]));
let signOk = 0;
let signBad = 0;
for (const g of w1) {
  if (g.spread === null || !g.spreadDetail) continue;
  const fav = teams.find((t) => t.abbrev === g.spreadDetail!.split(" ")[0]);
  if (!fav) continue;
  if ((fav.id === g.homeTeamId) === g.spread < 0) signOk++;
  else {
    signBad++;
    console.log(`      mismatch: ${g.spreadDetail} spread=${g.spread} home=${byId.get(g.homeTeamId)?.abbrev}`);
  }
}
check(signBad === 0, "spread sign agrees with the named favourite", `${signOk} checked`);

/* completed postseason: winners resolve */
const wc = await fetchWeek(season - 1, POSTSEASON, 1);
check(wc.length > 0, `${season - 1} wild card round returns games`, `${wc.length}`);
check(
  wc.every((g) => g.status !== "post" || g.winnerTeamId !== null || g.isTie),
  "every finished playoff game has a winner",
);
check(
  wc.every((g) => g.status !== "post" || (g.homeScore !== null && g.awayScore !== null)),
  "every finished playoff game has both scores",
);

console.log(`\n${failures === 0 ? "all checks passed" : `${failures} check(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
