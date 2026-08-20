/**
 * Captures the app for design review.
 *
 *   node scripts/shots.mjs <outDir> <route>[:name] ...
 *
 * Signs in as the demo member Finn, then captures each route at desktop and
 * mobile widths into <outDir>. Entrance transitions are disabled first so a
 * mid-animation frame is never mistaken for a missing element.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const [outDir, ...routeArgs] = process.argv.slice(2);
if (!outDir || routeArgs.length === 0) {
  console.error("usage: node scripts/shots.mjs <outDir> <route>[:name] ...");
  process.exit(1);
}

const BASE = process.env.BASE_URL || "http://localhost:3000";
const VIEWPORTS = [
  { tag: "desktop", width: 1440, height: 900 },
  { tag: "mobile", width: 390, height: 844 },
];

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const failures = [];

for (const { tag, width, height } of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: process.env.SCHEME === "dark" ? "dark" : "light",
    isMobile: tag === "mobile",
    hasTouch: tag === "mobile",
  });

  const page = await context.newPage();
  page.on("pageerror", (e) => failures.push(`[${tag}] page error: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") failures.push(`[${tag}] console: ${m.text()}`);
  });

  // Next's dev server holds an HMR websocket open, so "networkidle" never
  // fires. Wait for real elements instead.
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#f-username");
  await page.fill("#f-username", "Finn");
  await page.fill("#f-password", "password");
  await Promise.all([
    page.waitForURL("**/picks", { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);

  for (const arg of routeArgs) {
    const idx = arg.lastIndexOf(":");
    const route = idx > 0 ? arg.slice(0, idx) : arg;
    const name = idx > 0 ? arg.slice(idx + 1) : route.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "home";

    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("main", { timeout: 30000 });
    await page.waitForLoadState("load");

    // Settle motion so a mid-transition frame never reads as a missing element.
    await page.addStyleTag({
      content: `*,*::before,*::after{animation:none!important;transition:none!important}`,
    });

    // Team logos are lazy, so a full-page shot has to walk the page first or
    // everything below the fold captures blank.
    await page.evaluate(async () => {
      const step = window.innerHeight;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page
      .waitForFunction(() => Array.from(document.images).every((i) => i.complete), null, {
        timeout: 10000,
      })
      .catch(() => console.warn(`  (some images never loaded on ${route})`));
    await page.waitForTimeout(200);

    const file = `${outDir}/${name}-${tag}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
  }

  await context.close();
}

await browser.close();

if (failures.length > 0) {
  console.log("\nbrowser issues:");
  for (const f of [...new Set(failures)]) console.log(`  ${f}`);
}
