/**
 * Gives a member a new temporary password.
 *
 *   npm run reset-password -- "Jannis Orakel"
 *
 * Passwords are stored only as scrypt hashes, so a lost one cannot be looked
 * up — by you or anyone else. This replaces it instead, prints the new one once,
 * and signs the member out everywhere so an old session cannot outlive the
 * reset. On their next login the app makes them choose their own before it
 * shows anything else. Send them the printed password and nothing else.
 */
import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../lib/db/index.ts";
import { sessions, users } from "../lib/db/schema.ts";
import { hashPassword } from "../lib/password.ts";

const name = process.argv.slice(2).join(" ").trim();
if (!name) {
  console.error('Usage: npm run reset-password -- "username"');
  process.exit(1);
}

const [user] = await db
  .select({ id: users.id, username: users.username })
  .from(users)
  .where(eq(users.usernameLower, name.toLowerCase()));

if (!user) {
  const all = await db.select({ username: users.username }).from(users).orderBy(users.usernameLower);
  console.error(`No member called "${name}". Members: ${all.map((u) => u.username).join(", ")}`);
  process.exit(1);
}

// No 0/O or 1/l/I, so it survives being read out or retyped from a chat.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const word = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const password = `${word()}-${word()}-${word()}`;

await db
  .update(users)
  .set({ passwordHash: await hashPassword(password), mustChangePassword: true })
  .where(eq(users.id, user.id));
const signedOut = await db.delete(sessions).where(eq(sessions.userId, user.id)).returning({ id: sessions.id });

console.log(`\n  ${user.username}\n`);
console.log(`  new password:  ${password}`);
console.log(`  signed out of ${signedOut.length} session${signedOut.length === 1 ? "" : "s"}`);
console.log(`  they choose their own password on next login\n`);
process.exit(0);
