import { describe, it, expect } from "vitest";
import {
  computeWallMap,
  deriveWalkable,
  deriveRoomGrid,
  makeRoomAt,
  advance,
  initialSim,
  fmtTime,
  VOICE,
  OBJECTS,
  DAY_MIN,
  MIN_PER_TICK,
  TICK_MS,
  LOG_LEN,
} from "../lili_house_aitown.jsx";

const walkable = deriveWalkable(computeWallMap());
const roomAt = makeRoomAt(deriveRoomGrid(computeWallMap()));
const obj = (room) => OBJECTS.find((o) => o.room === room);

// Deterministic deps. rng=()=>0 makes every probability fire and picks pool[0].
const deps = (rng = () => 0) => ({ walkable, roomAt, rng });
const step = (s, rng) => advance(s, deps(rng));

describe("HVN-007 — simulation tick", () => {
  it("advances the clock +9 min/tick and rolls a new day at 1440", () => {
    expect(MIN_PER_TICK).toBe(9);
    expect(TICK_MS).toBe(850);
    const s1 = step(initialSim());
    expect(s1.t).toBe(8 * 60 + 9);
    const rolled = step({ ...initialSim(), t: DAY_MIN - 3, day: 2 });
    expect(rolled.day).toBe(3);
    expect(rolled.t).toBe(MIN_PER_TICK - 3); // (1437+9) - 1440
  });

  it("decays every drive by 3 each tick", () => {
    const s = step(initialSim()); // first tick just picks a target — no refill
    expect(s.drives).toEqual({ натхнення: 75, спокій: 57, енергія: 49, тепло: 43 });
  });

  it("with no target, picks one and sets a 'йде до' action (step 6)", () => {
    // Place the user in the hall so the warmth→office special case is inert;
    // warmth is the lowest initial drive → kitchen.
    const s = step({ ...initialSim(), you: { x: 13, y: 6 } });
    expect(roomAt(s.you.x, s.you.y)).toBe("hall");
    expect(s.target.room).toBe("kitchen");
    expect(s.action).toContain("йде до");
  });

  it("with the user in the office, warmth-lowest brings Лілі to you", () => {
    const s = step(initialSim()); // user starts in the office; lowest is тепло
    expect(roomAt(s.you.x, s.you.y)).toBe("office");
    expect(s.target.room).toBe("office");
  });

  it("steps one cell toward the target while en route (step 5)", () => {
    const start = { ...initialSim(), target: obj("bath"), action: "" };
    start.lili = { x: 5, y: 3, acting: false, actTicks: 0 };
    const s = step(start);
    const moved = Math.abs(s.lili.x - 5) + Math.abs(s.lili.y - 3);
    expect(moved).toBe(1);
    expect(walkable[s.lili.y][s.lili.x]).toBe(true);
    expect(s.action).toContain("йде до");
  });

  it("begins acting on arrival and emits a room voice line (step 5→4)", () => {
    const o = obj("kitchen");
    const onTarget = {
      ...initialSim(),
      lili: { x: o.x, y: o.y, acting: false, actTicks: 0 },
      target: o,
    };
    const s = step(onTarget);
    expect(s.lili.acting).toBe(true);
    expect(s.lili.actTicks).toBe(0);
    expect(VOICE.kitchen).toContain(s.voice);
    expect(s.log.at(-1).line).toBe(s.voice);
  });

  it("while acting, refills the target drive and ends at the threshold", () => {
    const o = obj("sleep"); // refills енергія
    let s = {
      ...initialSim(),
      lili: { x: o.x, y: o.y, acting: true, actTicks: 0 },
      target: o,
      drives: { натхнення: 80, спокій: 80, енергія: 50, тепло: 80 },
    };
    const before = s.drives.енергія;
    s = step(s);
    // +17 refill then -3 decay this tick = net +14
    expect(s.drives.енергія).toBe(before + 14);
    expect(s.lili.actTicks).toBe(1);
    // run until the action ends (actTicks≥4 or drive≥94)
    let guard = 0;
    while (s.lili.acting && guard++ < 10) s = step(s);
    expect(s.lili.acting).toBe(false);
    expect(s.target).toBe(null);
  });

  it("when together, labels '…з тобою поруч' and may take a `you` line", () => {
    const o = obj("office"); // user's room
    const s = step({
      ...initialSim(),
      lili: { x: o.x, y: o.y, acting: true, actTicks: 0 },
      you: { x: o.x, y: o.y + 1 }, // same room
      target: o,
      drives: { натхнення: 80, спокій: 80, енергія: 80, тепло: 50 },
    });
    expect(s.action).toContain("з тобою поруч");
    expect(VOICE.you).toContain(s.voice);
  });

  it("keeps only the last 5 log lines, each timestamped", () => {
    // Force many begin-acting events to generate lines.
    let s = initialSim();
    for (let i = 0; i < 60; i++) s = step(s);
    expect(s.log.length).toBeLessThanOrEqual(LOG_LEN);
    for (const e of s.log) {
      expect(typeof e.t).toBe("number");
      expect(typeof e.line).toBe("string");
    }
  });

  it("fmtTime renders HH:MM", () => {
    expect(fmtTime(8 * 60)).toBe("08:00");
    expect(fmtTime(0)).toBe("00:00");
    expect(fmtTime(13 * 60 + 5)).toBe("13:05");
  });
});
