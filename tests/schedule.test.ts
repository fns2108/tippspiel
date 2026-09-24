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

  it("warns before a London kickoff, not after it", () => {
    // Sunday 09:30 ET is 15:30 in Berlin — earlier than the 17:00 slot.
    const london = new Date("2026-10-11T13:30:00Z");
    const plan = planReminderSlots(
      [
        { id: "london", kickoff: london },
        { id: "early", kickoff: new Date("2026-10-11T17:00:00Z") }, // 13:00 ET
      ],
      TZ,
    );

    const slot = plan.find((p) => p.gameIds.includes("london"))!;
    assert.equal(slot.kind, "morning");
    assert.equal(berlin(slot.at), "So., 11.10., 09:00");
    assert.ok(slot.at < london, "the reminder lands before kickoff");
    assert.deepEqual(slot.gameIds, ["london"], "and it does not drag the 19:00 games along");

    const rest = plan.find((p) => p.gameIds.includes("early"))!;
    assert.equal(berlin(rest.at), "So., 11.10., 17:00", "the ordinary slate is unmoved");
  });

  it("moves a holiday afternoon game off the 19:00 slot", () => {
    // Christmas Day, 13:00 ET on a Friday — 19:00 in Berlin, the slot itself.
    const xmas = new Date("2026-12-25T18:00:00Z");
    const [slot] = planReminderSlots([{ id: "xmas", kickoff: xmas }], TZ);
    assert.equal(berlin(slot!.at), "Fr., 25.12., 17:00", "two hours is better than twelve");
    assert.ok(slot!.at < xmas);
  });

  it("warns the evening before a game with no announced time", () => {
    // ESPN gives a flexed game midnight Eastern, which is 06:00 in Germany —
    // every slot on the day itself would be the middle of the night.
    const tbd = new Date("2026-12-27T05:00:00Z");
    const [slot] = planReminderSlots([{ id: "tbd", kickoff: tbd }], TZ);
    assert.equal(slot!.kind, "evening-before");
    assert.equal(berlin(slot!.at), "Sa., 26.12., 19:00");
    assert.ok(slot!.at < tbd);
  });

  it("uses the afternoon when the clocks put a late game on top of 21:00", () => {
    // Late October: Europe is back on winter time while the US is not, so a
    // 16:05 ET kickoff is 21:05 in Berlin — five minutes after the slot.
    const squeezed = new Date("2026-10-25T20:05:00Z");
    const [slot] = planReminderSlots([{ id: "late", kickoff: squeezed }], TZ);
    assert.equal(berlin(slot!.at), "So., 25.10., 17:00");
    assert.ok(slot!.at < squeezed);
  });

  it("keeps the Sunday night game on the 21:00 slot", () => {
    // 22:25 kickoff leaves 85 minutes, which still counts as fair warning.
    const [slot] = planReminderSlots([{ id: "late", kickoff: new Date("2026-09-27T20:25:00Z") }], TZ);
    assert.equal(slot!.kind, "sunday-late");
    assert.equal(berlin(slot!.at), "So., 27.09., 21:00");
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
