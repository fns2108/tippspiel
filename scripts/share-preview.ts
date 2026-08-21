/**
 * Renders the weekly share image to a PNG on disk.
 *
 *   npm run share:preview -- 2025 5   # a specific week, from the database
 *   npm run share:preview             # the last week that was played
 *   npm run share:preview -- demo     # a fixture, no database needed
 *
 * The same function the route uses, so what lands on disk is what the group
 * would receive. Read-only: it touches nothing but the queries the page runs.
 *
 * `demo` exists because the layout has to be checkable out of season, when no
 * week has been played and the real card would be empty.
 */
import { writeFile } from "node:fs/promises";
import { weekRef } from "../lib/nfl/season.ts";
import { loadFonts, renderShareCard } from "../lib/share-image.tsx";
import type { ShareCard, ShareGame } from "../lib/share-card.ts";

function demoCard(): ShareCard {
  const names = ["Finn", "Jonas", "Marie", "Hendrik", "Lena", "Ben", "Sofia", "Til"];
  const scores = [11, 11, 10, 9, 9, 8, 6, 5];

  let rank = 0;
  const rows = names.map((username, i) => {
    if (i === 0 || scores[i] !== scores[i - 1]) rank = i + 1;
    return { rank, username, correct: scores[i], decided: 13, leader: scores[i] === scores[0] };
  });

  const fixtures: [string, string, number, number, string, string][] = [
    ["KC", "BUF", 27, 24, "#e31837", "#00338d"],
    ["PHI", "DAL", 17, 20, "#004c54", "#002244"],
    ["SF", "SEA", 31, 13, "#aa0000", "#002244"],
    ["BAL", "CIN", 24, 27, "#241773", "#fb4f14"],
    ["GB", "CHI", 20, 10, "#204e32", "#0b162a"],
    ["MIA", "NYJ", 14, 17, "#008e97", "#125740"],
    ["DET", "MIN", 30, 27, "#0076b6", "#4f2683"],
    ["LAR", "ARI", 21, 21, "#003594", "#97233f"],
    ["HOU", "IND", 23, 20, "#03202f", "#002c5f"],
    ["DEN", "LV", 16, 13, "#fb4f14", "#000000"],
    ["TB", "ATL", 28, 24, "#d50a0a", "#a71930"],
    ["PIT", "CLE", 13, 10, "#101820", "#311d00"],
    ["NE", "NYG", 17, 24, "#002244", "#0b2265"],
  ];

  const games: ShareGame[] = fixtures.map(([away, home, a, h, ca, ch]) => ({
    away,
    home,
    awayScore: a,
    homeScore: h,
    won: a === h ? null : a > h ? "away" : "home",
    tie: a === h,
    final: true,
    colorAway: ca,
    colorHome: ch,
    neutral: false,
  }));

  return {
    season: 2025,
    ref: weekRef(5),
    complete: true,
    started: true,
    totalGames: games.length,
    finalGames: games.length,
    rows,
    games,
    seasonTop: [
      { username: "Finn", correct: 48 },
      { username: "Marie", correct: 46 },
      { username: "Jonas", correct: 45 },
    ],
  };
}

async function realCard(season: number, ordinal: number | null) {
  // Imported lazily: the demo path must not need a database connection.
  const { loadShareCard } = await import("../lib/share-card.ts");
  const card = await loadShareCard(season, ordinal);
  if (!card.started) {
    console.error(`No week of ${season} has been played yet — try: npm run share:preview -- demo`);
    process.exit(1);
  }
  return card;
}

const demo = process.argv[2] === "demo";
const card = demo
  ? demoCard()
  : await realCard(Number(process.argv[2]) || new Date().getUTCFullYear(), Number(process.argv[3]) || null);

const image = renderShareCard(card, await loadFonts());
const png = Buffer.from(await image.arrayBuffer());

const out = process.env.OUT || `/tmp/tippspiel-${card.season}-w${card.ref.ordinal}.png`;
await writeFile(out, png);

console.log(`${card.ref.label} ${card.season}${demo ? "  (fixture)" : ""}`);
console.log(`  members  ${card.rows.length}`);
console.log(`  games    ${card.games.length} (${card.finalGames} final)`);
console.log(`  complete ${card.complete}`);
console.log(`  wrote    ${out}  ${(png.length / 1024).toFixed(0)} KB`);

process.exit(0);
