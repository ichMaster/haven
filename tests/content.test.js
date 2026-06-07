import { describe, it, expect } from "vitest";
import {
  ROOMS,
  OBJECTS,
  DECOR,
  ITEM,
  VOICE,
  computeWallMap,
  deriveWalkable,
  deriveRoomGrid,
  makeRoomAt,
} from "../lili_house_aitown.jsx";

const walkable = deriveWalkable(computeWallMap());
const roomAt = makeRoomAt(deriveRoomGrid(computeWallMap()));

describe("HVN-004 — rooms, objects, decor & voice", () => {
  it("ROOMS has all six keys with exact floor/color/verb + non-empty desc", () => {
    const expected = {
      hall: { floor: "#ece2cf", color: "#6b7280", verb: "йде" },
      office: { floor: "#cfe0f2", color: "#3b6fb0", verb: "поруч із тобою" },
      art: { floor: "#e6d6f2", color: "#7a52b0", verb: "малює" },
      sleep: { floor: "#f0d9ec", color: "#c0518f", verb: "спить" },
      kitchen: { floor: "#f1e7c0", color: "#b0832a", verb: "на кухні" },
      bath: { floor: "#cfe9e6", color: "#2a8f93", verb: "у ванні" },
    };
    expect(Object.keys(ROOMS).sort()).toEqual(Object.keys(expected).sort());
    for (const [k, v] of Object.entries(expected)) {
      expect(ROOMS[k].floor).toBe(v.floor);
      expect(ROOMS[k].color).toBe(v.color);
      expect(ROOMS[k].verb).toBe(v.verb);
      expect(ROOMS[k].name.length).toBeGreaterThan(0);
      expect(ROOMS[k].desc.length).toBeGreaterThan(10);
    }
  });

  it("OBJECTS places the five interactive glyphs at exact cells, tagged + walkable", () => {
    const byRoom = Object.fromEntries(OBJECTS.map((o) => [o.room, o]));
    expect(OBJECTS).toHaveLength(5);
    expect([byRoom.art.x, byRoom.art.y, byRoom.art.glyph]).toEqual([5, 3, "🎨"]);
    expect([byRoom.sleep.x, byRoom.sleep.y, byRoom.sleep.glyph]).toEqual([22, 2, "🛏️"]);
    expect([byRoom.kitchen.x, byRoom.kitchen.y, byRoom.kitchen.glyph]).toEqual([5, 11, "🍲"]);
    expect([byRoom.bath.x, byRoom.bath.y, byRoom.bath.glyph]).toEqual([22, 12, "🛁"]);
    expect([byRoom.office.x, byRoom.office.y, byRoom.office.glyph]).toEqual([20, 7, "💻"]);
    // each object sits on a walkable cell in its declared room
    for (const o of OBJECTS) {
      expect(walkable[o.y][o.x], `${o.glyph} walkable`).toBe(true);
      expect(roomAt(o.x, o.y), `${o.glyph} in ${o.room}`).toBe(o.room);
    }
  });

  it("DECOR adds several props per room and sits on walkable cells", () => {
    expect(DECOR.length).toBeGreaterThanOrEqual(20);
    const perRoom = {};
    for (const d of DECOR) {
      perRoom[d.room] = (perRoom[d.room] || 0) + 1;
      expect(walkable[d.y][d.x], `decor ${d.glyph} walkable`).toBe(true);
    }
    for (const room of ["art", "sleep", "office", "kitchen", "bath", "hall"])
      expect(perRoom[room] || 0, `decor in ${room}`).toBeGreaterThanOrEqual(3);
  });

  it("ITEM merges objects + decor by cell", () => {
    for (const o of OBJECTS) expect(ITEM[`${o.x},${o.y}`]).toBe(o.glyph);
    for (const d of DECOR) expect(ITEM[`${d.x},${d.y}`]).toBe(d.glyph);
    expect(Object.keys(ITEM).length).toBe(OBJECTS.length + DECOR.length);
  });

  it("VOICE provides room pools + you, with hall as the placeholder", () => {
    for (const k of ["art", "sleep", "kitchen", "bath", "office", "you"]) {
      expect(Array.isArray(VOICE[k]), `${k} is a pool`).toBe(true);
      expect(VOICE[k].length).toBeGreaterThan(0);
    }
    expect(VOICE.hall).toBe("…");
  });
});
