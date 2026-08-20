/**
 * Mints an invite key from the command line.
 *
 *   npm run invite                      # one key, single use
 *   npm run invite -- "for Jonas"       # labelled
 *   npm run invite -- "the group" 8     # 8 uses, e.g. one link for everyone
 *
 * The very first account has to come from here — until someone registers there
 * is no admin to generate keys in the interface. After that, use /admin.
 */
import { db } from "../lib/db/index.ts";
import { inviteKeys } from "../lib/db/schema.ts";
import { generateInviteCode } from "../lib/invite.ts";

const [label, usesArg] = process.argv.slice(2);
const maxUses = usesArg ? Number(usesArg) : 1;

if (!Number.isInteger(maxUses) || maxUses < 1) {
  console.error(`Uses must be a positive whole number; got "${usesArg}"`);
  process.exit(1);
}

const code = generateInviteCode();
await db.insert(inviteKeys).values({ code, label: label ?? null, maxUses });

console.log(`\n  ${code}\n`);
console.log(`  ${maxUses} use${maxUses === 1 ? "" : "s"}${label ? ` · ${label}` : ""}`);
console.log(`  share:  /register?key=${code}\n`);
process.exit(0);
