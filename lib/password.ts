import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

/**
 * Password hashing, kept free of any Next.js import so setup scripts can use it
 * outside the framework.
 *
 * scrypt ships with Node, so there is no native module to fail a deploy and
 * nothing to keep patched.
 */

// promisify resolves to the 3-argument overload; name the options one explicitly.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, nRaw, rRaw, pRaw, saltB64, keyB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");

  const key = await scryptAsync(password.normalize("NFKC"), salt, expected.length, {
    N: Number(nRaw),
    r: Number(rRaw),
    p: Number(pRaw),
  });

  return key.length === expected.length && timingSafeEqual(key, expected);
}
