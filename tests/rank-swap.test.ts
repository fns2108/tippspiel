import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { swapRank, type PickState } from "../lib/rank-swap.ts";

const week = (entries: [string, number | null][]) =>
  new Map<string, PickState>(entries.map(([id, rank]) => [id, { teamId: `t-${id}`, rank }]));

describe("optimistic rank swap", () => {
  it("moves both rows when the number is already taken", () => {
    // The reported bug: a=16, b=15, then a is set to 15 and both showed 15.
    const { next, displaced } = swapRank(week([["a", 16], ["b", 15]]), "a", 15);
    assert.equal(displaced, "b");
    assert.equal(next.get("a")!.rank, 15);
    assert.equal(next.get("b")!.rank, 16, "the displaced game takes the number it gave up");
  });

  it("leaves the rest of the week alone", () => {
    const { next } = swapRank(week([["a", 3], ["b", 2], ["c", 1]]), "a", 2);
    assert.equal(next.get("c")!.rank, 1);
    assert.equal(next.size, 3);
  });

  it("hands the displaced game nothing when the mover had nothing", () => {
    const { next, displaced } = swapRank(week([["a", null], ["b", 7]]), "a", 7);
    assert.equal(displaced, "b");
    assert.equal(next.get("a")!.rank, 7);
    assert.equal(next.get("b")!.rank, null);
  });

  it("just sets the number when nobody holds it", () => {
    const { next, displaced } = swapRank(week([["a", 16], ["b", 15]]), "a", 4);
    assert.equal(displaced, null);
    assert.equal(next.get("a")!.rank, 4);
    assert.equal(next.get("b")!.rank, 15);
  });

  it("clears without disturbing anyone", () => {
    const { next, displaced } = swapRank(week([["a", 16], ["b", 15]]), "a", null);
    assert.equal(displaced, null);
    assert.equal(next.get("a")!.rank, null);
    assert.equal(next.get("b")!.rank, 15);
  });

  it("never mutates the state it was given", () => {
    const before = week([["a", 16], ["b", 15]]);
    swapRank(before, "a", 15);
    assert.equal(before.get("a")!.rank, 16);
    assert.equal(before.get("b")!.rank, 15);
  });

  it("keeps the team when only the number moves", () => {
    const { next } = swapRank(week([["a", 16], ["b", 15]]), "a", 15);
    assert.equal(next.get("a")!.teamId, "t-a");
    assert.equal(next.get("b")!.teamId, "t-b");
  });
});
