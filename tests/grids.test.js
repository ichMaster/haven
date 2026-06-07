import { describe, it, expect } from "vitest";
import {
  W,
  H,
  computeWallMap,
  deriveWalkable,
  deriveRoomGrid,
  makeRoomAt,
} from "../lili_house_aitown.jsx";

const wallMap = computeWallMap();
const walkable = deriveWalkable(wallMap);
const roomGrid = deriveRoomGrid(wallMap);
const roomAt = makeRoomAt(roomGrid);

describe("HVN-003 — derived grids", () => {
  it("walkable: true for interiors, doors, hall; false for walls", () => {
    expect(walkable[1][1]).toBe(true); // studio interior
    expect(walkable[3][12]).toBe(true); // hall spine
    expect(walkable[3][11]).toBe(true); // a door
    expect(walkable[0][0]).toBe(false); // outer wall
    expect(walkable[7][0]).toBe(false); // wall between rooms/edge
    // sanity: count matches non-# cells
    const nonWall = wallMap.flat().filter((c) => c !== "#").length;
    const walk = walkable.flat().filter(Boolean).length;
    expect(walk).toBe(nonWall);
  });

  it("roomGrid: each interior cell carries its room key", () => {
    expect(roomGrid[1][1]).toBe("art");
    expect(roomGrid[10][1]).toBe("kitchen");
    expect(roomGrid[1][12]).toBe("hall");
    expect(roomGrid[1][17]).toBe("sleep");
    expect(roomGrid[7][17]).toBe("office");
    expect(roomGrid[12][17]).toBe("bath");
    expect(roomGrid[0][0]).toBe(null); // wall
  });

  it("door cells resolve to the adjacent non-hall room", () => {
    expect(roomGrid[3][11]).toBe("art"); // studio door
    expect(roomGrid[10][11]).toBe("kitchen"); // kitchen door
    expect(roomGrid[2][16]).toBe("sleep"); // bedroom door
    expect(roomGrid[7][16]).toBe("office"); // office door
    expect(roomGrid[12][16]).toBe("bath"); // bathroom door
  });

  it("roomAt returns the right key, hall for walls / off-grid", () => {
    expect(roomAt(1, 1)).toBe("art");
    expect(roomAt(12, 1)).toBe("hall");
    expect(roomAt(0, 0)).toBe("hall"); // wall → hall fallback
    expect(roomAt(-1, 5)).toBe("hall"); // off-grid
    expect(roomAt(W, H)).toBe("hall"); // off-grid
  });
});
