/**
 * Local development data. Never run this against production.
 *
 *   npm run sync -- 2025 && npm run seed:demo
 *
 * Creates a handful of members with the password "password" and gives them
 * picks, so the standings, grid and profile pages have something real to render
 * while you work on them. Everything it writes is synthetic.
 */
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../lib/db/index.ts";
import { games, picks, users } from "../lib/db/schema.ts";
import { hashPassword } from "../lib/password.ts";

const SEASONS = [2025, 2026];

const MEMBERS = [
  { name: "Finn", admin: true, bias: 0.62 },
  { name: "Jonas", admin: false, bias: 0.55 },
  { name: "Lena", admin: false, bias: 0.6 },
  { name: "Marc", admin: false, bias: 0.48 },
  { name: "Pia", admin: false, bias: 0.58 },
  { name: "Tobi", admin: false, bias: 0.5 },
];

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed demo data in production.");
  process.exit(1);
}

const lowered = MEMBERS.map((m) => m.name.toLowerCase());
const existing = await db.select({ id: users.id }).from(users).where(inArray(users.usernameLower, lowered));
if (existing.length > 0) {
  const ids = existing.map((u) => u.id);
  await db.delete(picks).where(inArray(picks.userId, ids));
  await db.delete(users).where(inArray(users.id, ids));
}

const passwordHash = await hashPassword("password");
const ids = new Map<string, string>();

for (const m of MEMBERS) {
  const id = randomUUID();
  ids.set(m.name, id);
  await db.insert(users).values({
    id,
    username: m.name,
    usernameLower: m.name.toLowerCase(),
    passwordHash,
    isAdmin: m.admin,
  });
}
console.log(`${MEMBERS.length} members created (password: "password")`);

// Deterministic, so re-running gives the same board.
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
};

for (const season of SEASONS) {
  const list = await db
    .select({
      id: games.id,
      homeTeamId: games.homeTeamId,
      awayTeamId: games.awayTeamId,
      spread: games.spread,
      kickoff: games.kickoff,
      winnerTeamId: games.winnerTeamId,
    })
    .from(games)
    .where(eq(games.season, season));

  if (list.length === 0) {
    console.log(`  ${season}: no games loaded, skipping`);
    continue;
  }

  const rows: { userId: string; gameId: string; teamId: string }[] = [];

  for (const m of MEMBERS) {
    const userId = ids.get(m.name)!;
    for (const g of list) {
      const r = hash(`${m.name}:${g.id}`);

      // Leave some of the still-open games unpicked so the reminder banner and
      // the "hidden until kickoff" states are visible while developing.
      const open = g.kickoff.getTime() > Date.now();
      if (open && r > 0.72) continue;
      if (!open && r > 0.97) continue;

      const spread = g.spread === null ? null : Number(g.spread);
      const favourite =
        spread === null || spread === 0 ? g.homeTeamId : spread < 0 ? g.homeTeamId : g.awayTeamId;
      const underdog = favourite === g.homeTeamId ? g.awayTeamId : g.homeTeamId;

      // Members back the favourite at their own rate, which produces a
      // plausible spread of records rather than four identical rows.
      const takesFavourite = hash(`pick:${m.name}:${g.id}`) < m.bias + 0.2;
      rows.push({ userId, gameId: g.id, teamId: takesFavourite ? favourite : underdog });
    }
  }

  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(picks).values(rows.slice(i, i + 500));
  }
  console.log(`  ${season}: ${rows.length} picks across ${list.length} games`);
}

console.log("\nsign in as Finn / password");
process.exit(0);
