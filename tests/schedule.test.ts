import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planReminderSlots, recapInstant } from "../lib/schedule.ts";

const TZ = "Europe/Berlin";
/** Berlin wall clock, for readable assertions. */
const berlin = (d: Date) =>
  new Intl.DateTimeFormat("de-DE", {
    timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(d);

// A real week 3 of 2026, in UTC. ET is UTC-4 in September.
const games = [
  { id: "thu", kickoff: new Date("2026-09-25T00:15:00Z") }, // Thu 20:15 ET
  { id: "sun-early-a", kickoff: new Date("2026-09-27T17:00:00Z") }, // Sun 13:00 ET
  { id: "sun-early-b", kickoff: new Date("2026-09-27T17:00:00Z") },
  { id: "sun-late", kickoff: new Date("2026-09-27T20:25:00Z") }, // Sun 16:25 ET
  { id: "sun-night", kickoff: new Date("2026-09-28T00:20:00Z") }, // Sun 20:20 ET
  { id: "mon", kickoff: new Date("2026-09-29T00:15:00Z") }, // Mon 20:15 ET
];

describe("reminder schedule", () => {
  const slots = planReminderSlots(games, TZ);

  it("makes one slot per day, plus two on Sunday", () => {
    assert.deepEqual(
      slots.map((s) => `${s.kind} ${s.gameIds.join("+")}`),
      [
        "weekday thu",
        "sunday-early sun-early-a+sun-early-b",
        "sunday-late sun-late+sun-night",
        "weekday mon",
      ],
    );
  });

  it("puts them at the right German evening", () => {
    assert.deepEqual(slots.map((s) => berlin(s.at)), [
      "Do., 24.09., 19:00", // the Thursday game, which kicks off 02:15 on Friday
      "So., 27.09., 17:00",
      "So., 27.09., 21:00",
      "Mo., 28.09., 19:00", // the Monday game, which kicks off 02:15 on Tuesday
    ]);
  });

  it("always warns before kickoff", () => {
    for (const slot of slots) {
      assert.ok(
        slot.at < slot.firstKickoff,
        `${slot.id}: reminder ${berlin(slot.at)} is not before kickoff ${berlin(slot.firstKickoff)}`,
      );
    }
  });

  it("groups the night game with the afternoon one, not with the early slate", () => {
    const late = slots.find((s) => s.kind === "sunday-late")!;
    assert.ok(late.gameIds.includes("sun-night"));
    assert.equal(berlin(late.firstKickoff), "So., 27.09., 22:25");
  });

  it("names the day the NFL would, not the German calendar day", () => {
    assert.equal(slots[0]!.dayLabel, "Donnerstag");
    assert.equal(slots.at(-1)!.dayLabel, "Montag");
  });

  it("sends the recap the morning after the last game ends", () => {
    // Monday night kicks off 02:15 Tuesday Berlin and ends in the small hours.
    assert.equal(berlin(recapInstant(new Date("2026-09-29T00:15:00Z"), TZ)), "Di., 29.09., 07:00");
    // A week that ends with the Sunday night game recaps on the Monday.
    assert.equal(berlin(recapInstant(new Date("2026-09-28T00:20:00Z"), TZ)), "Mo., 28.09., 07:00");
  });

  it("still says 19:00 when the clocks have changed", () => {
    // Germany leaves summer time on 25 October 2026; this week is after it.
    const winter = planReminderSlots(
      [{ id: "thu", kickoff: new Date("2026-11-27T01:15:00Z") }], // Thu 20:15 ET
      TZ,
    );
    assert.equal(berlin(winter[0]!.at), "Do., 26.11., 19:00");
  });
});
