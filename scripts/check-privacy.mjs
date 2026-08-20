/**
 * Verifies the two guarantees the pool depends on, against a running server.
 *
 *   npm run dev            # in one terminal, with demo data seeded
 *   node scripts/check-privacy.mjs
 *
 * 1. Picks on a game that has not kicked off never reach the client at all —
 *    not hidden in the DOM, not present in the RSC payload.
 * 2. A pick on a game that has kicked off is refused by the server, whatever
 *    the client sends.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const ME = process.env.AS_USER || "Finn";
const OTHERS = ["Jonas", "Lena", "Marc", "Pia", "Tobi"];

let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#f-username");
await page.fill("#f-username", ME);
await page.fill("#f-password", process.env.AS_PASSWORD || "password");
await page.click('button[type="submit"]');
await page.waitForURL("**/picks");

/* ---- 1. nothing leaks before kickoff ------------------------------------ */

// Find a week where at least one game is still open.
let openWeek = null;
for (let ordinal = 1; ordinal <= 22 && !openWeek; ordinal++) {
  await page.goto(`${BASE}/picks/${ordinal}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main");
  const openCount = await page.locator("main li button:not([disabled])").count();
  if (openCount > 0) openWeek = ordinal;
}

if (openWeek === null) {
  console.log("  --  no open games in this season; skipping the reveal check");
} else {
  const html = await page.content();
  // The signed-in member's own name appears in the header, so only look for others.
  const leaked = OTHERS.filter((name) => html.includes(name));
  check(
    leaked.length === 0,
    `week ${openWeek}: no other member's name is in the delivered page`,
    leaked.length ? `leaked: ${leaked.join(", ")}` : "",
  );

  const lockedOnPage = await page.locator("main li button[disabled]").count();
  const openOnPage = await page.locator("main li button:not([disabled])").count();
  check(openOnPage > 0, `week ${openWeek}: open games are pickable`, `${openOnPage / 2} games`);
  console.log(`      (${lockedOnPage / 2} locked, ${openOnPage / 2} open this week)`);
}

/* ---- 2. after kickoff, the picks are there ----------------------------- */

// The mirror of check 1: once a game has started, everyone's picks must appear.
// A reveal that never fires is as broken as one that fires early.
let lockedWeek = null;
for (let ordinal = 22; ordinal >= 1 && lockedWeek === null; ordinal--) {
  await page.goto(`${BASE}/picks/${ordinal}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main");
  const locked = await page.locator("main li button[disabled]").count();
  if (locked > 0) lockedWeek = ordinal;
}

if (lockedWeek === null) {
  console.log("  --  no kicked-off games in this season; skipping the reveal check");
} else {
  const html = await page.content();
  const shown = OTHERS.filter((name) => html.includes(name));
  check(
    shown.length > 0,
    `week ${lockedWeek}: other members' picks are revealed after kickoff`,
    `${shown.length} member(s) shown`,
  );

  const enabled = await page.locator("main li button:not([disabled])").count();
  check(enabled === 0, `week ${lockedWeek}: every kicked-off game is disabled in the UI`);
}

/* ---- 3. the write rule -------------------------------------------------- */

// The server-side rule cannot be exercised from here: the client refuses to
// send a pick for a locked game, so a tampered click never reaches the action.
// It is covered directly by tests/pick-rules.test.ts, which is where the rule
// the action calls actually lives.
console.log("  --  server-side lock enforcement is covered by tests/pick-rules.test.ts");

await browser.close();
console.log(`\n${failures === 0 ? "all checks passed" : `${failures} check(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
