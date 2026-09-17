import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyAdjustments } from "../lib/adjustments.ts";
import type { WeekStanding } from "../lib/queries.ts";

const names = new Map([["finn", "Finn"], ["luis", "luis"]]);
const row = (userId: string, points: number): WeekStanding => ({
  userId, username: names.get(userId)!, points, adjustment: 0, correct: 5, picked: 16, decided: 16,
});

describe("point corrections", () => {
  it("adds to the points a member earned that week", () => {
    const perWeek = new Map([[3, new Map([["finn", row("finn", 70)]])]]);
    applyAdjustments(perWeek, [{ userId: "finn", ordinal: 3, points: 5 }], names);
    const r = perWeek.get(3)!.get("finn")!;
    assert.equal(r.points, 75);
    assert.equal(r.adjustment, 5);
    assert.equal(r.correct, 5, "picks-derived counts are untouched");
  });

  it("takes points away", () => {
    const perWeek = new Map([[3, new Map([["finn", row("finn", 70)]])]]);
    applyAdjustments(perWeek, [{ userId: "finn", ordinal: 3, points: -12 }], names);
    assert.equal(perWeek.get(3)!.get("finn")!.points, 58);
  });

  it("credits a member who picked nothing that week", () => {
    const perWeek = new Map([[3, new Map([["finn", row("finn", 70)]])]]);
    applyAdjustments(perWeek, [{ userId: "luis", ordinal: 3, points: 40 }], names);
    const r = perWeek.get(3)!.get("luis")!;
    assert.equal(r.points, 40);
    assert.equal(r.picked, 0);
  });

  it("creates the week when no one had picked in it", () => {
    const perWeek = new Map<number, Map<string, WeekStanding>>();
    applyAdjustments(perWeek, [{ userId: "finn", ordinal: 7, points: 3 }], names);
    assert.equal(perWeek.get(7)!.get("finn")!.points, 3);
  });

  it("sums several corrections for the same week", () => {
    const perWeek = new Map([[3, new Map([["finn", row("finn", 70)]])]]);
    applyAdjustments(
      perWeek,
      [{ userId: "finn", ordinal: 3, points: 5 }, { userId: "finn", ordinal: 3, points: -2 }],
      names,
    );
    const r = perWeek.get(3)!.get("finn")!;
    assert.equal(r.points, 73);
    assert.equal(r.adjustment, 3);
  });

  it("ignores a correction for an account that no longer exists", () => {
    const perWeek = new Map([[3, new Map([["finn", row("finn", 70)]])]]);
    applyAdjustments(perWeek, [{ userId: "gone", ordinal: 3, points: 99 }], names);
    assert.equal(perWeek.get(3)!.size, 1);
  });
});
