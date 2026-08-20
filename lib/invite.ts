import { randomInt } from "node:crypto";

/**
 * Codes get read aloud, typed on phones, and pasted into WhatsApp, so the
 * alphabet drops every character pair that gets confused in those settings:
 * no O/0, no I/1/L, no U/V.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTWXYZ23456789";

export function generateInviteCode(): string {
  const block = (n: number) =>
    Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${block(4)}-${block(4)}`;
}

/** Accepts what someone actually types: any case, with or without the dash. */
export function normalizeInviteCode(raw: string): string {
  const bare = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (bare.length !== 8) return raw.trim().toUpperCase();
  return `${bare.slice(0, 4)}-${bare.slice(4)}`;
}
