/**
 * Haven v0.1 — graphical home + autonomous Лілі (single self-contained file).
 *
 * Spec: specification/PROTOTYPE_PHASE1_SPEC.md. This one file holds the whole
 * world in the browser — floor plan, single-agent drive simulation, BFS
 * navigation, the tick loop, and the AI Town-style SVG render — with no backend
 * (the FastAPI backend owns all of this from v1).
 *
 * "Backend in cells, frontend in motion": the simulation reasons only in integer
 * grid cells; all smoothing/gliding is CSS-transition animation in the render.
 *
 * Pure logic (computeWallMap, derived grids, bfsNext, pickTarget, the tick
 * reducer, day/night + UI math) is exported by name so /tests can exercise it;
 * the default export `LiliHouseAITown` is the mountable component.
 */
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";

// ── Grid & scene constants (spec §2) ─────────────────────────────────────────
export const W = 29; // columns
export const H = 15; // rows
export const TILE = 24; // px per cell
export const SW = W * TILE; // 696
export const SH = H * TILE; // 360

// ── Palette (spec §2) ────────────────────────────────────────────────────────
export const PALETTE = {
  page: "#f3efe6", // warm cream page background
  surround: "#bcd9b0", // soft grass scene surround (above the house)
};

// ── World: floor plan (spec §3) ──────────────────────────────────────────────
// Letter → room-key map for the carved rectangles.
export const LETTER = {
  A: "art", // Майстерня Лілі (studio)
  K: "kitchen", // Кухня
  H: "hall", // Хол (hub-spine)
  S: "sleep", // Наша спальня (bedroom)
  O: "office", // Мій кабінет
  V: "bath", // Ванна
};

// Room interiors (inclusive), char → [x0, y0, x1, y1] in grid cells.
export const ROOM_RECTS = {
  A: [1, 1, 10, 6], // studio (large)
  K: [1, 8, 10, 13], // kitchen (large)
  H: [12, 1, 15, 13], // hall (vertical corridor spine)
  S: [17, 1, 27, 4], // bedroom (wide, short)
  O: [17, 6, 27, 9], // office (medium)
  V: [17, 11, 27, 13], // bathroom (small)
};

// Door cells (walkable openings, char "+"), [x, y]. Each connects a room to the
// hall, so any room-to-room path passes through the hall spine.
export const DOORS = [
  [11, 3], // studio ↔ hall
  [11, 10], // kitchen ↔ hall
  [16, 2], // bedroom ↔ hall
  [16, 7], // office ↔ hall
  [16, 12], // bathroom ↔ hall
];

// Build the H×W character grid: start all walls "#", carve room rectangles,
// then open the doors. Pure — depends only on the constants above.
export function computeWallMap() {
  const grid = Array.from({ length: H }, () => Array.from({ length: W }, () => "#"));
  const rect = (x0, y0, x1, y1, ch) => {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) grid[y][x] = ch;
  };
  for (const [ch, [x0, y0, x1, y1]] of Object.entries(ROOM_RECTS)) {
    rect(x0, y0, x1, y1, ch);
  }
  for (const [x, y] of DOORS) grid[y][x] = "+";
  return grid;
}

// ── Derived grids (spec §4) ──────────────────────────────────────────────────
// Boolean passability: every non-wall cell (room, door, hall) is walkable.
export function deriveWalkable(wallMap) {
  return wallMap.map((row) => row.map((ch) => ch !== "#"));
}

// Room key per cell. Room interiors map via LETTER; a door "+" adopts its
// adjacent non-hall room (so standing in a doorway counts as the room you enter);
// walls are null.
export function deriveRoomGrid(wallMap) {
  const NEI = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  return wallMap.map((row, y) =>
    row.map((ch, x) => {
      if (ch === "+") {
        for (const [dx, dy] of NEI) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const nch = wallMap[ny][nx];
          if (LETTER[nch] && nch !== "H") return LETTER[nch];
        }
        return "hall";
      }
      return LETTER[ch] ?? null; // room letter → key; wall "#" → null
    }),
  );
}

// roomAt(x,y) → room key, falling back to "hall" off-grid or on a wall cell.
export function makeRoomAt(roomGrid) {
  return (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return "hall";
    return roomGrid[y][x] || "hall";
  };
}

// ── Simulation state container ───────────────────────────────────────────────
// The clock starts mid-morning; voice/log/drives/agent fields are filled in by
// later issues (HVN-005/007). Kept minimal here so the scaffold renders alone.
export function initialSim() {
  return {
    t: 8 * 60, // minutes into the day (08:00)
    day: 1,
    voice: "",
    log: [],
  };
}

export default function LiliHouseAITown() {
  const [sim, setSim] = useState(initialSim);

  // Async mirror of `sim` for use inside setInterval / async callbacks (HVN-007),
  // where the latest committed state is needed without re-binding the interval.
  const simRef = useRef(sim);
  useEffect(() => {
    simRef.current = sim;
  }, [sim]);

  // Static world, derived once and memoized (never recomputed per render).
  const wallMap = useMemo(() => computeWallMap(), []);
  const walkable = useMemo(() => deriveWalkable(wallMap), [wallMap]);
  const roomGrid = useMemo(() => deriveRoomGrid(wallMap), [wallMap]);
  const roomAt = useMemo(() => makeRoomAt(roomGrid), [roomGrid]);
  // Consumed by the simulation + render in later issues (HVN-005/007/008).
  void walkable;
  void roomAt;

  return (
    <div
      style={{
        background: PALETTE.page,
        minHeight: "100%",
        padding: 16,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: SW, margin: "0 auto" }}>
        <svg
          viewBox={`0 0 ${SW} ${SH}`}
          width="100%"
          style={{ display: "block", background: PALETTE.surround, borderRadius: 8 }}
          role="img"
          aria-label="Дім Лілі"
        >
          {/* Scene layers (tiles, props, sprites, bubble, day/night) — HVN-008+ */}
        </svg>
      </div>
    </div>
  );
}
