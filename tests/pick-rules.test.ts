import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLocked, rejectPick } from "../lib/pick-rules.ts";
import { resolveIsAdmin } from "../lib/admin.ts";

const NOW = new Date("2026-09-13T17:00:00Z");
const game = (kickoff: string) => ({
  kickoff: new Date(kickoff),
  homeTeamId: "34",
  awayTeamId: "13",
});

describe("pick enforcement", () => {
  it("allows a pick on a game that has not kicked off", () => {
    assert.equal(rejectPick(game("2026-09-13T17:00:01Z"), "34", NOW), null);
    assert.equal(rejectPick(game("2026-09-14T00:00:00Z"), "13", NOW), null);
  });

  it("refuses a pick the instant a game kicks off", () => {
    // The boundary is the whole rule: at exactly kickoff, picks are shut.
    assert.equal(rejectPick(game("2026-09-13T17:00:00Z"), "34", NOW), "KICKED_OFF");
    assert.equal(rejectPick(game("2026-09-13T16:59:59Z"), "34", NOW), "KICKED_OFF");
    assert.equal(rejectPick(game("2020-01-01T00:00:00Z"), "34", NOW), "KICKED_OFF");
  });

  it("refuses a team that is not playing in the game", () => {
    assert.equal(rejectPick(game("2026-09-14T00:00:00Z"), "1", NOW), "TEAM_NOT_IN_GAME");
    assert.equal(rejectPick(game("2026-09-14T00:00:00Z"), "", NOW), "TEAM_NOT_IN_GAME");
  });

  it("refuses a game that does not exist", () => {
    assert.equal(rejectPick(undefined, "34", NOW), "NO_SUCH_GAME");
    assert.equal(rejectPick(null, "34", NOW), "NO_SUCH_GAME");
  });

  it("checks the lock before the team, so a locked game cannot be probed", () => {
    // A kicked-off game reports KICKED_OFF even for a nonsense team, rather
    // than confirming which teams are in it.
    assert.equal(rejectPick(game("2020-01-01T00:00:00Z"), "999", NOW), "KICKED_OFF");
  });

  it("allows clearing a pick, but not after kickoff", () => {
    assert.equal(rejectPick(game("2026-09-14T00:00:00Z"), null, NOW), null);
    assert.equal(rejectPick(game("2020-01-01T00:00:00Z"), null, NOW), "KICKED_OFF");
  });

  it("uses the same lock definition the read path uses", () => {
    // Reads and writes disagreeing about "locked" is how a pick leaks early.
    for (const kickoff of [
      "2026-09-13T16:59:59Z",
      "2026-09-13T17:00:00Z",
      "2026-09-13T17:00:01Z",
      "2027-01-01T00:00:00Z",
    ]) {
      const g = game(kickoff);
      const locked = isLocked(g.kickoff, NOW);
      const refused = rejectPick(g, "34", NOW) === "KICKED_OFF";
      assert.equal(locked, refused, `disagreement at ${kickoff}`);
    }
  });
});

describe("admin resolution", () => {
  const withEnv = (value: string | undefined, fn: () => void) => {
    const previous = process.env.ADMIN_USERNAMES;
    if (value === undefined) delete process.env.ADMIN_USERNAMES;
    else process.env.ADMIN_USERNAMES = value;
    try {
      fn();
    } finally {
      if (previous === undefined) delete process.env.ADMIN_USERNAMES;
      else process.env.ADMIN_USERNAMES = previous;
    }
  };

  it("makes ADMIN_USERNAMES the complete list when it is set", () => {
    withEnv("stolten", () => {
      assert.equal(resolveIsAdmin("stolten", false), true, "listed, so admin even if the row says no");
      assert.equal(resolveIsAdmin("finn", true), false, "not listed, so not admin even if the row says yes");
    });
  });

  it("accepts several names, any spacing or case", () => {
    withEnv(" Stolten , finn ", () => {
      assert.equal(resolveIsAdmin("stolten", false), true);
      assert.equal(resolveIsAdmin("finn", false), true);
      assert.equal(resolveIsAdmin("jonas", false), false);
    });
  });

  it("falls back to the stored flag when the variable is unset or blank", () => {
    withEnv(undefined, () => {
      assert.equal(resolveIsAdmin("finn", true), true);
      assert.equal(resolveIsAdmin("jonas", false), false);
    });
    withEnv("   ", () => {
      assert.equal(resolveIsAdmin("finn", true), true);
    });
  });
});
