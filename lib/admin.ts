/**
 * Who counts as an admin.
 *
 * Kept free of Next imports so it can be tested directly, and so scripts can
 * reason about it without booting the framework.
 */

function adminUsernames(): string[] {
  return (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Resolved at read time, not at registration.
 *
 * When ADMIN_USERNAMES is set it is the complete and only list: nobody else is
 * an admin, whatever the database says. That makes admin a deployment setting
 * rather than an accident of who happened to register first, and it means it
 * cannot be granted from inside the app.
 *
 * With the variable unset it falls back to the stored flag, which is what
 * bootstraps the very first account on a fresh install.
 */
export function resolveIsAdmin(usernameLower: string, storedFlag: boolean): boolean {
  const list = adminUsernames();
  if (list.length > 0) return list.includes(usernameLower);
  return storedFlag;
}

/** True when the deployment has declared its admins explicitly. */
export function adminsAreDeclared(): boolean {
  return adminUsernames().length > 0;
}

export { adminUsernames };
