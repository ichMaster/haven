import { describe, it, expect } from "vitest";
import {
  W,
  H,
  LETTER,
  ROOM_RECTS,
  DOORS,
  computeWallMap,
} from "../lili_house_aitown.jsx";

const map = computeWallMap();

// 4-neighbour flood fill over non-wall cells from a start, returns visited set.
function flood(grid, sx, sy) {
  const seen = new Set();
  const stack = [[sx, sy]];
  const key = (x, y) => `${x},${y}`;
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    if (grid[y][x] === "#") continue;
    if (seen.has(key(x, y))) continue;
    seen.add(key(x, y));
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return seen;
}

describe("HVN-002 — floor plan (computeWallMap)", () => {
  it("returns a 15×29 grid", () => {
    expect(map.length).toBe(H);
    expect(map.every((row) => row.length === W)).toBe(true);
  });

  it("carves each room at its exact inclusive interior", () => {
    for (const [ch, [x0, y0, x1, y1]] of Object.entries(ROOM_RECTS)) {
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++)
          expect(map[y][x], `(${x},${y}) should be ${ch}`).toBe(ch);
    }
  });

  it("keeps the six rooms at their specified differing sizes", () => {
    expect(ROOM_RECTS.A).toEqual([1, 1, 10, 6]);
    expect(ROOM_RECTS.K).toEqual([1, 8, 10, 13]);
    expect(ROOM_RECTS.H).toEqual([12, 1, 15, 13]);
    expect(ROOM_RECTS.S).toEqual([17, 1, 27, 4]);
    expect(ROOM_RECTS.O).toEqual([17, 6, 27, 9]);
    expect(ROOM_RECTS.V).toEqual([17, 11, 27, 13]);
  });

  it("opens exactly the five doors as '+'", () => {
    expect(DOORS).toEqual([
      [11, 3],
      [11, 10],
      [16, 2],
      [16, 7],
      [16, 12],
    ]);
    for (const [x, y] of DOORS) expect(map[y][x]).toBe("+");
  });

  it("each door bridges its room and the hall spine", () => {
    // Studio/kitchen doors sit on x=11: studio/kitchen to the left, hall right.
    expect(map[3][10]).toBe("A");
    expect(map[3][12]).toBe("H");
    expect(map[10][10]).toBe("K");
    expect(map[10][12]).toBe("H");
    // Bedroom/office/bathroom doors sit on x=16: hall left, room right.
    expect(map[2][15]).toBe("H");
    expect(map[2][17]).toBe("S");
    expect(map[7][15]).toBe("H");
    expect(map[7][17]).toBe("O");
    expect(map[12][15]).toBe("H");
    expect(map[12][17]).toBe("V");
  });

  it("connects every room through the hall (flood fill from the studio)", () => {
    const seen = flood(map, 1, 1); // a studio cell
    const reaches = (ch) => {
      const [x0, y0, x1, y1] = ROOM_RECTS[ch];
      // a representative interior cell per room
      return seen.has(`${x0},${y0}`) || seen.has(`${x1},${y1}`);
    };
    for (const ch of Object.keys(ROOM_RECTS))
      expect(reaches(ch), `room ${ch} reachable`).toBe(true);
  });

  it("maps each room char to its key", () => {
    expect(LETTER).toEqual({
      A: "art",
      K: "kitchen",
      H: "hall",
      S: "sleep",
      O: "office",
      V: "bath",
    });
  });
});
