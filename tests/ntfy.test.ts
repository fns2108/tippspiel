import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appUrl,
  encodeHeader,
  generateNtfyTopic,
  isValidNtfyTopic,
  normalizeNtfyTopic,
  recapTitle,
  slotMessage,
} from "../lib/ntfy.ts";

describe("ntfy topics", () => {
  it("generates something long enough not to be guessed", () => {
    const topic = generateNtfyTopic();
    assert.ok(isValidNtfyTopic(topic), topic);
    assert.ok(topic.length >= 24, topic);
  });

  it("never generates the same topic twice", () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateNtfyTopic()));
    assert.equal(seen.size, 200);
  });

  it("refuses short or oddly punctuated topics", () => {
    assert.equal(isValidNtfyTopic("kurz"), false);
    assert.equal(isValidNtfyTopic("pickem wedel 2026"), false);
    assert.equal(isValidNtfyTopic("pickem.wedel.2026"), false);
    assert.equal(isValidNtfyTopic(""), false);
  });

  it("takes a pasted url as readily as a bare topic", () => {
    assert.equal(normalizeNtfyTopic("  pickem-abcdefghijkl  "), "pickem-abcdefghijkl");
    assert.equal(normalizeNtfyTopic("https://ntfy.sh/pickem-abcdefghijkl"), "pickem-abcdefghijkl");
    assert.equal(normalizeNtfyTopic("https://ntfy.sh/pickem-abcdefghijkl/"), "pickem-abcdefghijkl");
    assert.equal(normalizeNtfyTopic(""), null);
    assert.equal(normalizeNtfyTopic("https://ntfy.sh/kurz"), null);
  });

  it("lists the games that are still untipped", () => {
    const m = slotMessage({
      topic: "pickem-abcdefghijkl",
      games: ["KC @ BUF", "PHI @ DAL", "SF vs SEA"],
      appUrl: "https://tippspiel-wedel.vercel.app/",
    });
    assert.equal(m.title, "Heute: 3 ungetippte Spiele");
    assert.equal(m.message, "KC @ BUF\nPHI @ DAL\nSF vs SEA");
    assert.equal(m.click, "https://tippspiel-wedel.vercel.app/picks");
  });

  it("says Spiel, not Spiele, for a single game", () => {
    const m = slotMessage({ topic: "t", games: ["KC @ BUF"] });
    assert.equal(m.title, "Heute: 1 ungetipptes Spiel");
    assert.equal(m.message, "KC @ BUF");
    assert.equal(m.click, undefined, "no link without APP_URL");
  });

  it("falls back to the domain Vercel provides when APP_URL is unset", () => {
    const before = { app: process.env.APP_URL, vercel: process.env.VERCEL_PROJECT_PRODUCTION_URL };
    try {
      delete process.env.APP_URL;
      process.env.VERCEL_PROJECT_PRODUCTION_URL = "tippspiel-wedel.vercel.app";
      assert.equal(appUrl(), "https://tippspiel-wedel.vercel.app");

      process.env.APP_URL = "https://tippspiel.example/";
      assert.equal(appUrl(), "https://tippspiel.example", "APP_URL wins, without a trailing slash");

      delete process.env.APP_URL;
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
      assert.equal(appUrl(), null);
    } finally {
      if (before.app) process.env.APP_URL = before.app;
      if (before.vercel) process.env.VERCEL_PROJECT_PRODUCTION_URL = before.vercel;
    }
  });

  it("titles the week's picture without naming the winner", () => {
    assert.equal(recapTitle("Woche 3"), "Woche 3 ist durch");
    assert.equal(recapTitle("Super Bowl"), "Super Bowl ist durch");
  });

  it("wraps umlauts for headers, and leaves plain text alone", () => {
    assert.equal(encodeHeader("Woche 3 ist durch"), "Woche 3 ist durch");
    assert.equal(encodeHeader("Läuft — 9/16"), "=?UTF-8?B?TMOkdWZ0IOKAlCA5LzE2?=");
    assert.equal(
      Buffer.from("TMOkdWZ0IOKAlCA5LzE2", "base64").toString("utf8"),
      "Läuft — 9/16",
      "and it round-trips",
    );
  });
});
