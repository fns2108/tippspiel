import "server-only";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { inviteKeys, inviteRedemptions, sessions, users } from "@/lib/db/schema";
import { adminUsernames, resolveIsAdmin } from "@/lib/admin";
import { normalizeInviteCode } from "@/lib/invite";
import { hashPassword, verifyPassword } from "@/lib/password";

const SESSION_COOKIE = "pickem_session";
const SESSION_DAYS = 60;

/* ------------------------------------------------------------- sessions */

/** Only the hash is stored, so a database leak cannot be replayed as a login. */
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  store.delete(SESSION_COOKIE);
}

export type SessionUser = {
  id: string;
  username: string;
  isAdmin: boolean;
};

/** The current user, or null. Safe to call from any server component. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      usernameLower: users.usernameLower,
      isAdmin: users.isAdmin,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())));

  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    isAdmin: resolveIsAdmin(row.usernameLower, row.isAdmin),
  };
}

/**
 * For pages that must not render anonymously.
 *
 * Redirects rather than throwing: Next renders a layout and its page
 * concurrently, so a page that threw would surface an error before the
 * layout's own redirect had a chance to land.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/picks");
  return user;
}

/* -------------------------------------------------------- registration */

export class RegistrationError extends Error {}

const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9 _-]{1,22}[a-zA-Z0-9])$/;

export function validateUsername(raw: string): string {
  const username = raw.trim().replace(/\s+/g, " ");
  if (!USERNAME_RE.test(username)) {
    throw new RegistrationError(
      "Names are 3–24 characters, using letters, numbers, spaces, hyphens and underscores.",
    );
  }
  return username;
}

export function validatePassword(password: string): string {
  if (password.length < 8) {
    throw new RegistrationError("Passwords need at least 8 characters.");
  }
  if (password.length > 200) {
    throw new RegistrationError("That password is too long.");
  }
  return password;
}

/**
 * Redeems an invite key and creates the account in one transaction, so a key
 * with one use left cannot be spent twice by two simultaneous registrations.
 */
export async function registerUser(input: {
  username: string;
  password: string;
  inviteCode: string;
}): Promise<SessionUser> {
  const username = validateUsername(input.username);
  validatePassword(input.password);
  const code = normalizeInviteCode(input.inviteCode);
  const usernameLower = username.toLowerCase();
  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    // Conditional UPDATE ... RETURNING is the lock: if no row comes back, the
    // key was already exhausted, revoked, expired, or never existed.
    const claimed = await tx
      .update(inviteKeys)
      .set({ usedCount: sql`${inviteKeys.usedCount} + 1` })
      .where(
        and(
          eq(inviteKeys.code, code),
          sql`${inviteKeys.usedCount} < ${inviteKeys.maxUses}`,
          sql`${inviteKeys.revokedAt} is null`,
          sql`(${inviteKeys.expiresAt} is null or ${inviteKeys.expiresAt} > now())`,
        ),
      )
      .returning({ code: inviteKeys.code });

    if (claimed.length === 0) {
      throw new RegistrationError("That invite key is not valid, or has already been used up.");
    }

    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(users);
    const isAdmin =
      adminUsernames().includes(usernameLower) ||
      (adminUsernames().length === 0 && count === 0);

    const id = randomUUID();
    try {
      await tx.insert(users).values({ id, username, usernameLower, passwordHash, isAdmin });
    } catch {
      throw new RegistrationError("That name is already taken.");
    }

    await tx.insert(inviteRedemptions).values({ code, userId: id });
    return { id, username, isAdmin };
  });
}

export async function authenticate(
  usernameRaw: string,
  password: string,
): Promise<SessionUser | null> {
  const usernameLower = usernameRaw.trim().toLowerCase();

  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      isAdmin: users.isAdmin,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.usernameLower, usernameLower));

  if (!row) {
    // Burn comparable time so a missing account is not distinguishable by timing.
    await hashPassword(password);
    return null;
  }

  const ok = await verifyPassword(password, row.passwordHash);
  if (!ok) return null;
  return { id: row.id, username: row.username, isAdmin: resolveIsAdmin(usernameLower, row.isAdmin) };
}

export { resolveIsAdmin };
