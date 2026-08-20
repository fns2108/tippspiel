/**
 * Loads the 32 teams and downloads their logos into public/teams/.
 *
 *   npm run seed:teams
 *
 * Logos are stored locally rather than hotlinked so the picking page has no
 * third-party image dependency on a Sunday afternoon.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fetchTeams } from "../lib/espn/client.ts";
import { syncTeams } from "../lib/espn/sync.ts";

const OUT = "public/teams";

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
    await writeFile(`${OUT}/${file}`, Buffer.from(await res.arrayBuffer()));
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
