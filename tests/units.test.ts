import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashPassword, verifyPassword } from "../lib/password.ts";
import { generateInviteCode, normalizeInviteCode } from "../lib/invite.ts";
import { teamColors } from "../lib/nfl/colors.ts";
import { countdown, describeLine, formatSpread, nflDayLabel, pct } from "../lib/format.ts";
import {
  computePayouts,
  money,
  parseMoneyToCents,
  signedMoney,
} from "../lib/payouts.ts";
import { currentSeason, isValidOrdinal, toOrdinal, weekRef } from "../lib/nfl/season.ts";
import { POSTSEASON, REGULAR } from "../lib/espn/client.ts";

describe("passwords", () => {
  it("round-trips", async () => {
    const hash = await hashPassword("correct horse battery staple");
    assert.equal(await verifyPassword("correct horse battery staple", hash), true);
    assert.equal(await verifyPassword("wrong", hash), false);
  });

  it("salts, so identical passwords do not collide", async () => {
    assert.notEqual(await hashPassword("same"), await hashPassword("same"));
  });

  it("normalises unicode so a composed and decomposed password match", async () => {
    const hash = await hashPassword("paßwort-é");
    assert.equal(await verifyPassword("paßwort-é", hash), true);
  });

  it("rejects a malformed stored hash instead of throwing", async () => {
    assert.equal(await verifyPassword("x", "not-a-hash"), false);
    assert.equal(await verifyPassword("x", "scrypt$1$2$3"), false);
  });
});

describe("invite codes", () => {
  it("avoids characters that get misread aloud", () => {
    for (let i = 0; i < 200; i++) {
      assert.match(generateInviteCode(), /^[ABCDEFGHJKMNPQRSTWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTWXYZ23456789]{4}$/);
    }
  });

  it("accepts what people actually type", () => {
    assert.equal(normalizeInviteCode("abcd-2345"), "ABCD-2345");
    assert.equal(normalizeInviteCode("abcd2345"), "ABCD-2345");
    assert.equal(normalizeInviteCode("  ABCD 2345 "), "ABCD-2345");
  });
});

describe("week ordinals", () => {
  it("maps the regular season one-to-one", () => {
    for (let w = 1; w <= 18; w++) assert.equal(toOrdinal(REGULAR, w), w);
  });

  it("excludes the Pro Bowl and keeps the four real rounds", () => {
    assert.equal(toOrdinal(POSTSEASON, 1), 19);
    assert.equal(toOrdinal(POSTSEASON, 2), 20);
    assert.equal(toOrdinal(POSTSEASON, 3), 21);
    assert.equal(toOrdinal(POSTSEASON, 4), null, "the Pro Bowl is not pickable");
    assert.equal(toOrdinal(POSTSEASON, 5), 22);
  });

  it("round-trips every valid ordinal", () => {
    for (let o = 1; o <= 22; o++) {
      const ref = weekRef(o);
      assert.equal(toOrdinal(ref.seasonType, ref.week), o);
    }
  });

  it("rejects out-of-range ordinals", () => {
    assert.equal(isValidOrdinal(0), false);
    assert.equal(isValidOrdinal(23), false);
    assert.equal(isValidOrdinal(1.5), false);
    assert.throws(() => weekRef(23));
  });

  it("puts January and February in the previous season", () => {
    delete process.env.NFL_SEASON;
    assert.equal(currentSeason(new Date("2027-02-08T00:00:00Z")), 2026, "the Super Bowl belongs to 2026");
    assert.equal(currentSeason(new Date("2026-09-10T00:00:00Z")), 2026);
    assert.equal(currentSeason(new Date("2026-03-01T00:00:00Z")), 2026);
  });
});

describe("spreads", () => {
  it("renders sign and half-points the way a book writes them", () => {
    assert.equal(formatSpread(-3.5), "−3.5");
    assert.equal(formatSpread(3.5), "+3.5");
    assert.equal(formatSpread(-7), "−7");
    assert.equal(formatSpread(0), "PK");
  });

  it("reads the favourite off a home-relative spread", () => {
    const home = { abbrev: "SEA" };
    const away = { abbrev: "NE" };
    assert.match(describeLine(-3.5, home, away)!, /^SEA favorisiert mit 3.5$/);
    assert.match(describeLine(3.5, home, away)!, /^NE favorisiert mit 3.5$/);
    assert.equal(describeLine(null, home, away), null);
    assert.match(describeLine(0, home, away)!, /Pick/);
  });
});

describe("team colours", () => {
  const contrast = (hex: string, ground: [number, number, number]) => {
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
    const lum = (c: [number, number, number]) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const a = lum(rgb);
    const b = lum(ground);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };

  const LIGHT: [number, number, number] = [0xfb, 0xfb, 0xfa];
  const DARK: [number, number, number] = [0x1a, 0x19, 0x17];

  it("keeps pure black readable on a dark ground (the Raiders case)", () => {
    const c = teamColors("000000", "a5acaf");
    assert.ok(contrast(c.dark, DARK) >= 3, `dark ${c.dark} contrast ${contrast(c.dark, DARK)}`);
    assert.ok(contrast(c.light, LIGHT) >= 3);
  });

  it("keeps near-white readable on paper", () => {
    const c = teamColors("ffffff", "ffb612");
    assert.ok(contrast(c.light, LIGHT) >= 3, `light ${c.light}`);
  });

  it("survives a missing or malformed colour", () => {
    for (const [a, b] of [
      [null, null],
      ["", ""],
      ["nothex", "alsonot"],
      ["#123456", null],
    ] as [string | null, string | null][]) {
      const c = teamColors(a, b);
      assert.match(c.light, /^#[0-9a-f]{6}$/);
      assert.match(c.dark, /^#[0-9a-f]{6}$/);
      assert.ok(contrast(c.light, LIGHT) >= 3);
      assert.ok(contrast(c.dark, DARK) >= 3);
    }
  });

  it("clears the bar for every real NFL primary colour", () => {
    // Every current primary, including the awkward ones.
    const primaries = [
      "97233f", "a71930", "241773", "00338d", "0085ca", "0b162a", "fb4f14", "311d00",
      "041e42", "fb4f14", "0076b6", "203731", "03202f", "002c5f", "006778", "e31837",
      "000000", "0080c6", "003594", "008e97", "4f2683", "002244", "d3bc8d", "0b2265",
      "125740", "003c7f", "004c54", "ffb612", "aa0000", "002244", "d50a0a", "5a1414",
    ];
    for (const hex of primaries) {
      const c = teamColors(hex, "ffffff");
      assert.ok(contrast(c.light, LIGHT) >= 3, `${hex} on paper → ${c.light}`);
      assert.ok(contrast(c.dark, DARK) >= 3, `${hex} on ink → ${c.dark}`);
    }
  });
});

describe("formatting", () => {
  it("groups a Monday nighter under Monday, not the European Tuesday", () => {
    // 02:15 Tuesday in Berlin is still Monday night in the NFL's own calendar.
    assert.equal(nflDayLabel(new Date("2026-10-06T00:15:00Z")), "Montag");
  });

  it("counts down in units that read at a glance", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    assert.equal(countdown(new Date("2026-09-01T12:38:00Z"), now), "38 Min");
    assert.equal(countdown(new Date("2026-09-01T16:12:00Z"), now), "4 Std 12 Min");
    assert.equal(countdown(new Date("2026-09-04T12:00:00Z"), now), "3 Tage");
    assert.equal(countdown(new Date("2026-09-01T11:00:00Z"), now), "jetzt");
  });

  it("renders percentages without a leading zero, and copes with none played", () => {
    assert.equal(pct(11, 14), ".786");
    assert.equal(pct(0, 0), "—");
  });
});

describe("payouts", () => {
  const members = ["a", "b", "c", "d"];
  const week = (ordinal: number, winnerIds: string[], complete = true) => ({
    ordinal,
    complete,
    winnerIds,
  });
  /** Every regular week loaded, so the pot has something to divide across. */
  const regular = (winners: (string[] | null)[]) =>
    winners.map((w, i) => week(i + 1, w ?? [], w !== null));

  it("divides the pot into a season prize and equal weekly shares", () => {
    const p = computePayouts(
      { buyInCents: 2000, seasonPrizeCents: 2000, includePlayoffs: false },
      members,
      regular(Array.from({ length: 18 }, () => null)),
      [],
    );
    assert.equal(p.potCents, 8000);
    // 80,00 pot − 20,00 season = 60,00 over 18 weeks = 3,33 each, 6 cents over.
    assert.equal(p.weeklyPrizeCents, 333);
    assert.equal(p.seasonPrizeCents, 2000 + 6);
    assert.equal(p.pendingCents, 333 * 18);
  });

  it("splits a tied week and keeps the odd cent in the pot", () => {
    const weeks = regular([["a", "b"], ...Array.from({ length: 17 }, () => null)]);
    const p = computePayouts(
      { buyInCents: 2000, seasonPrizeCents: 2000, includePlayoffs: false },
      members,
      weeks,
      [],
    );
    // 333 split two ways is 166 each; the stray cent goes to the season prize.
    assert.equal(p.byUser.get("a")!.weeklyCents, 166);
    assert.equal(p.byUser.get("b")!.weeklyCents, 166);
    assert.equal(p.byUser.get("a")!.weeksWon, 1);
    assert.equal(p.seasonPrizeCents, 2000 + 6 + 1);
  });

  it("pays out every cent that was paid in, once the season is done", () => {
    // A whole season with a spread of outright wins, ties and a blank week.
    const winners: (string[] | null)[] = Array.from({ length: 18 }, (_, i) =>
      i === 5 ? [] : i % 3 === 0 ? ["a", "b"] : [members[i % 4]],
    );
    const p = computePayouts(
      { buyInCents: 2500, seasonPrizeCents: 3000, includePlayoffs: false },
      members,
      regular(winners),
      ["a"],
    );
    assert.equal(p.seasonSettled, true);
    assert.equal(p.pendingCents, 0);
    const paid = [...p.byUser.values()].reduce((sum, r) => sum + r.totalCents, 0);
    assert.equal(paid, p.potCents, "every cent of the pot is allocated");
    const net = [...p.byUser.values()].reduce((sum, r) => sum + r.netCents, 0);
    assert.equal(net, 0, "the pool is zero-sum");
  });

  it("counts playoff weeks only when the toggle says so", () => {
    const weeks = [...regular(Array.from({ length: 18 }, () => null)), week(19, []), week(22, [])];
    const off = computePayouts({ buyInCents: 1000, seasonPrizeCents: 0, includePlayoffs: false }, members, weeks, []);
    const on = computePayouts({ buyInCents: 1000, seasonPrizeCents: 0, includePlayoffs: true }, members, weeks, []);
    assert.equal(off.payoutWeeks.length, 18);
    assert.equal(on.payoutWeeks.length, 20);
    assert.ok(on.weeklyPrizeCents < off.weeklyPrizeCents, "the same pot spread wider pays less");
  });

  it("stays switched off when nobody paid in", () => {
    const p = computePayouts(
      { buyInCents: 0, seasonPrizeCents: 0, includePlayoffs: false },
      members,
      regular([["a"]]),
      ["a"],
    );
    assert.equal(p.enabled, false);
    assert.equal(p.byUser.get("a")!.totalCents, 0);
    assert.equal(p.byUser.get("a")!.netCents, 0);
  });

  it("refuses to pay a season prize larger than the pot", () => {
    const p = computePayouts(
      { buyInCents: 500, seasonPrizeCents: 100000, includePlayoffs: false },
      members,
      regular(Array.from({ length: 18 }, () => null)),
      [],
    );
    assert.equal(p.weeklyPrizeCents, 0);
    assert.equal(p.seasonPrizeCents, p.potCents);
  });

  it("reads and writes amounts the way a person types them", () => {
    assert.equal(parseMoneyToCents("12,50"), 1250);
    assert.equal(parseMoneyToCents("12.50"), 1250);
    assert.equal(parseMoneyToCents(" 20 € "), 2000);
    assert.equal(parseMoneyToCents(""), 0);
    assert.equal(parseMoneyToCents("12,505"), null);
    assert.equal(parseMoneyToCents("zwölf"), null);
    assert.equal(money(1250), "12,50 €");
    assert.equal(signedMoney(-750), "−7,50 €");
  });
});
