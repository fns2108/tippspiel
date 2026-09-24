import { randomBytes } from "node:crypto";

/**
 * Reminders over ntfy.
 *
 * Apple only allows web push for a site that has been added to the Home
 * Screen, which is a step half a pool will never take. ntfy is a normal app
 * from the App Store: the member subscribes to a topic in it, and this sends
 * one HTTP request. No keys, no accounts, nothing to expire.
 *
 * The topic is the whole secret — anyone who knows it can both read the
 * reminders and post to it — so topics are generated here rather than chosen,
 * and are long enough not to be guessed.
 */

/** Overridable so a self-hosted ntfy can be pointed at instead. */
export const ntfyServer = (): string =>
  (process.env.NTFY_SERVER || "https://ntfy.sh").replace(/\/+$/, "");

/** What ntfy itself accepts in a topic, minus the shortest, guessable ones. */
const TOPIC = /^[A-Za-z0-9_-]{12,64}$/;

export function isValidNtfyTopic(topic: string): boolean {
  return TOPIC.test(topic);
}

/**
 * A topic nobody will stumble onto.
 *
 * base64url over 18 bytes is 24 characters from ntfy's own alphabet, so there
 * is nothing to strip and no chance of producing something too short.
 */
export function generateNtfyTopic(): string {
  return `pickem-${randomBytes(18).toString("base64url")}`;
}

/** Accepts a bare topic or a full ntfy URL, since people paste both. */
export function normalizeNtfyTopic(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const topic = trimmed.replace(/^https?:\/\/[^/]+\//i, "").replace(/\/+$/, "");
  return isValidNtfyTopic(topic) ? topic : null;
}

export type NtfyMessage = {
  topic: string;
  title: string;
  message: string;
  /** Opened when the notification is tapped. */
  click?: string;
  tags?: string[];
};

export type NtfyResult = { ok: true } | { ok: false; error: string };

/**
 * Sends one notification.
 *
 * Published as JSON to the server root rather than as headers on a topic URL:
 * HTTP headers are ASCII, and a German title carries umlauts that would have to
 * be encoded by hand.
 */
export async function sendNtfy(message: NtfyMessage): Promise<NtfyResult> {
  try {
    const res = await fetch(ntfyServer(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });

    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 200);
      return { ok: false, error: `ntfy ${res.status} ${res.statusText}${body ? `: ${body}` : ""}` };
    }
    return { ok: true };
  } catch (err) {
    // A reminder is never worth failing the request that triggered it.
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Headers are ASCII. A German title carries umlauts and an em dash, so anything
 * outside that range is wrapped the way mail has always done it (RFC 2047).
 */
export function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** The reminder for one slot: how many are still open, and which. */
export function slotMessage(input: {
  topic: string;
  /** "KC @ BUF", one per line — abbreviations, because this is a phone. */
  games: string[];
  appUrl?: string | null;
}): NtfyMessage {
  const n = input.games.length;
  return {
    topic: input.topic,
    title: `Heute: ${n} ungetippte${n === 1 ? "s Spiel" : " Spiele"}`,
    message: input.games.join("\n"),
    tags: ["football"],
    ...(input.appUrl ? { click: `${input.appUrl.replace(/\/+$/, "")}/picks` } : {}),
  };
}

/** The title over the week's picture. The winner is in the picture itself. */
export function recapTitle(weekLabel: string): string {
  return `${weekLabel} ist durch`;
}

/**
 * Sends a file — the week's picture.
 *
 * Uploads go as a PUT with the bytes as the body, so the title and filename
 * have to travel in headers. On ntfy.sh an attachment is reachable for three
 * hours; the notification itself keeps showing it, and `click` points at the
 * share page so it can still be sent on afterwards.
 */
export async function sendNtfyFile(input: {
  topic: string;
  bytes: Uint8Array;
  filename: string;
  title: string;
  message?: string;
  click?: string;
}): Promise<NtfyResult> {
  try {
    const res = await fetch(`${ntfyServer()}/${encodeURIComponent(input.topic)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "image/png",
        Filename: input.filename,
        Title: encodeHeader(input.title),
        ...(input.message ? { Message: encodeHeader(input.message) } : {}),
        ...(input.click ? { Click: input.click } : {}),
      },
      body: Buffer.from(input.bytes),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });

    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 200);
      return { ok: false, error: `ntfy ${res.status} ${res.statusText}${body ? `: ${body}` : ""}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
