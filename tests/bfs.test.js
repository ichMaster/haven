import { describe, it, expect } from "vitest";
import {
  computeWallMap,
  deriveWalkable,
  deriveRoomGrid,
  makeRoomAt,
  bfsNext,
  OBJECTS,
} from "../lili_house_aitown.jsx";

const walkable = deriveWalkable(computeWallMap());
const roomAt = makeRoomAt(deriveRoomGrid(computeWallMap()));
const obj = (room) => OBJECTS.find((o) => o.room === room);

// Walk start → goal one bfsNext step at a time; collect the visited path.
function walkPath(start, goal, cap = 200) {
  const path = [start];
  let cur = start;
  for (let i = 0; i < cap; i++) {
    if (cur.x === goal.x && cur.y === goal.y) return path;
    const next = bfsNext(cur, goal, walkable);
    if (next.x === cur.x && next.y === cur.y) break; // stuck / unreachable
    path.push(next);
    cur = next;
  }
  return path;
}

const adjacent = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

describe("HVN-006 — BFS navigation (bfsNext)", () => {
  it("returns start when already at the goal", () => {
    const p = { x: 5, y: 3 };
    expect(bfsNext(p, { x: 5, y: 3 }, walkable)).toEqual(p);
  });

  it("returns the single adjacent goal as the first step", () => {
    const start = { x: 5, y: 3 };
    const goal = { x: 6, y: 3 };
    expect(bfsNext(start, goal, walkable)).toEqual(goal);
  });

  it("steps exactly one walkable 4-neighbour cell per call", () => {
    const start = obj("art"); // (5,3)
    const goal = obj("bath"); // (22,12)
    const next = bfsNext(start, goal, walkable);
    expect(adjacent(start, next)).toBe(true);
    expect(walkable[next.y][next.x]).toBe(true);
  });

  it("reaches a cross-house goal, passing through the hall, never a wall", () => {
    const start = obj("art"); // studio (5,3)
    const goal = obj("bath"); // bathroom (22,12)
    const path = walkPath(start, goal);
    const last = path[path.length - 1];
    expect(last).toEqual({ x: goal.x, y: goal.y }); // reached
    // every step adjacent + walkable
    for (let i = 1; i < path.length; i++) {
      expect(adjacent(path[i - 1], path[i])).toBe(true);
      expect(walkable[path[i].y][path[i].x]).toBe(true);
    }
    // shortest path between rooms passes through the hall spine
    expect(path.some((c) => roomAt(c.x, c.y) === "hall")).toBe(true);
  });

  it("studio → kitchen also routes through the hall", () => {
    const path = walkPath(obj("art"), obj("kitchen"));
    expect(path[path.length - 1]).toEqual({ x: 5, y: 11 });
    expect(path.some((c) => roomAt(c.x, c.y) === "hall")).toBe(true);
  });

  it("returns start when the goal is unreachable", () => {
    // tiny grid with the goal walled off in its own pocket
    const w = [
      [true, true, false],
      [true, true, false],
      [false, false, true],
    ];
    const start = { x: 0, y: 0 };
    const goal = { x: 2, y: 2 };
    expect(bfsNext(start, goal, w)).toEqual(start);
  });
});
