/**
 * Loads the 32 teams and downloads their logos into public/teams/.
 *
 *   npm run seed:teams
 *
 * Logos are stored locally rather than hotlinked so the picking page has no
 * third-party image dependency on a Sunday afternoon.
 */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { fetchTeams } from "../lib/espn/client.ts";
import { syncTeams } from "../lib/espn/sync.ts";

const OUT = "public/teams";

/**
 * ESPN serves these at 500px. The largest slot in the interface is 28px, so
 * 160 covers it comfortably even at 2x — and keeps the whole set, which is
 * committed to the repo, around a megabyte instead of four.
 */
const MAX_PX = 160;

const count = await syncTeams();
console.log(`teams in database: ${count}`);

await mkdir(OUT, { recursive: true });

const list = await fetchTeams();
let downloaded = 0;
let failed = 0;

async function save(url: string | null, file: string) {
  if (!url) return;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

    // Resize here rather than after the fact, so re-running this script cannot
    // quietly put the full-size originals back.
    const resized = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(MAX_PX, MAX_PX, { fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();

    await writeFile(`${OUT}/${file}`, resized);
    downloaded++;
  } catch (err) {
    failed++;
    console.warn(`  could not fetch ${file}: ${err instanceof Error ? err.message : err}`);
  }
}

for (const team of list) {
  const slug = team.abbrev.toLowerCase();
  await save(team.logoLight, `${slug}.png`);
  await save(team.logoDark, `${slug}-dark.png`);
}

console.log(`logos: ${downloaded} saved, ${failed} failed → ${OUT}/`);
process.exit(failed > 0 ? 1 : 0);
