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

// ── Room config (spec §5) ────────────────────────────────────────────────────
// name (label), floor (pastel tile color), color (accent for room cards),
// verb (action word), desc (atmospheric Ukrainian interior description).
export const ROOMS = {
  hall: {
    name: "Хол",
    floor: "#ece2cf",
    color: "#6b7280",
    verb: "йде",
    desc: "Світлий хол з'єднує всі кімнати дому. Тут завжди чути кроки й тихі голоси.",
  },
  office: {
    name: "Мій кабінет",
    floor: "#cfe0f2",
    color: "#3b6fb0",
    verb: "поруч із тобою",
    desc: "Твій кабінет: книги, тепле світло лампи й крісло, у якому добре думається.",
  },
  art: {
    name: "Майстерня Лілі",
    floor: "#e6d6f2",
    color: "#7a52b0",
    verb: "малює",
    desc: "Майстерня Лілі: запах фарби, полотна під вікном і світло, що тече на мольберт.",
  },
  sleep: {
    name: "Наша спальня",
    floor: "#f0d9ec",
    color: "#c0518f",
    verb: "спить",
    desc: "Наша спальня: м'яке покривало, місяць у вікні й тиша, у якій легко заснути.",
  },
  kitchen: {
    name: "Кухня",
    floor: "#f1e7c0",
    color: "#b0832a",
    verb: "на кухні",
    desc: "Кухня пахне чаєм і свіжим хлібом; на підвіконні гріється зелень.",
  },
  bath: {
    name: "Ванна кімната",
    floor: "#cfe9e6",
    color: "#2a8f93",
    verb: "у ванні",
    desc: "Ванна кімната: пара, свічка й тепла вода, що змиває втому дня.",
  },
};

// ── Objects & decor (spec §6) ────────────────────────────────────────────────
// Interactive drive targets — the cell Лілі walks to and acts on.
export const OBJECTS = [
  { x: 5, y: 3, glyph: "🎨", room: "art" },
  { x: 22, y: 2, glyph: "🛏️", room: "sleep" },
  { x: 5, y: 11, glyph: "🍲", room: "kitchen" },
  { x: 22, y: 12, glyph: "🛁", room: "bath" },
  { x: 20, y: 7, glyph: "💻", room: "office" },
];

// Non-interactive props, a few per room (~24 total), for atmosphere only.
export const DECOR = [
  // studio
  { x: 1, y: 1, glyph: "🖼️", room: "art" },
  { x: 8, y: 1, glyph: "🖌️", room: "art" },
  { x: 1, y: 6, glyph: "🪴", room: "art" },
  { x: 9, y: 3, glyph: "🪟", room: "art" },
  // bedroom
  { x: 17, y: 1, glyph: "🪟", room: "sleep" },
  { x: 27, y: 1, glyph: "🌙", room: "sleep" },
  { x: 17, y: 4, glyph: "🪴", room: "sleep" },
  { x: 26, y: 4, glyph: "👗", room: "sleep" },
  // office
  { x: 17, y: 6, glyph: "📚", room: "office" },
  { x: 27, y: 6, glyph: "☕", room: "office" },
  { x: 17, y: 9, glyph: "🪑", room: "office" },
  { x: 27, y: 9, glyph: "🪟", room: "office" },
  // kitchen
  { x: 1, y: 8, glyph: "🫖", room: "kitchen" },
  { x: 9, y: 8, glyph: "🪟", room: "kitchen" },
  { x: 3, y: 8, glyph: "🍞", room: "kitchen" },
  { x: 1, y: 13, glyph: "🔪", room: "kitchen" },
  { x: 9, y: 13, glyph: "🪴", room: "kitchen" },
  // bathroom
  { x: 17, y: 11, glyph: "🚿", room: "bath" },
  { x: 27, y: 11, glyph: "🪞", room: "bath" },
  { x: 17, y: 13, glyph: "🧴", room: "bath" },
  { x: 27, y: 13, glyph: "🕯️", room: "bath" },
  // hall
  { x: 12, y: 1, glyph: "🖼️", room: "hall" },
  { x: 15, y: 1, glyph: "🧥", room: "hall" },
  { x: 13, y: 13, glyph: "🪴", room: "hall" },
];

// Merged item lookup for rendering: ITEM["x,y"] → glyph (objects first).
export const ITEM = (() => {
  const m = {};
  for (const o of OBJECTS) m[`${o.x},${o.y}`] = o.glyph;
  for (const d of DECOR) m[`${d.x},${d.y}`] = d.glyph;
  return m;
})();

// ── Voice (spec §11) ─────────────────────────────────────────────────────────
// Fixed in-character Ukrainian line pools per acting room, plus `you` (lines for
// when the user is near) and a `hall` placeholder. Model-generated only from v2.1.
export const VOICE = {
  art: [
    "Тут народжується щось нове…",
    "Колір лягає сам собою.",
    "Ще один мазок — і відпущу.",
  ],
  sleep: ["Трохи перепочину…", "Очі злипаються.", "Подрімаю хвилинку."],
  kitchen: ["Заварю собі чаю.", "Пахне теплом і домом.", "Щось смачненьке…"],
  bath: ["Тепла вода — це спокій.", "Змиваю втому дня.", "Ще хвильку тиші."],
  office: ["Побуду тут, поряд із тобою.", "Зазирнула до тебе.", "Як ти тут?"],
  you: ["Я рада, що ти поруч.", "Сумувала за тобою.", "Розкажеш, як минув день?"],
  hall: "…",
};

// ── Drives & target selection (spec §7–8) ────────────────────────────────────
// Лілі's four drives (Ukrainian keys), each 0..100, in display order.
export const DRIVE_KEYS = ["натхнення", "спокій", "енергія", "тепло"];
export const DRIVES_INIT = { натхнення: 78, спокій: 60, енергія: 52, тепло: 46 };

// Tunables.
export const DECAY = 3; // drop per drive per tick
export const REFILL = 17; // gain on the active drive per acting tick
export const ACT_TICKS_MAX = 4; // action ends at this many ticks…
export const DRIVE_FULL = 94; // …or when the active drive reaches this

export const DRIVE_COLORS = {
  натхнення: "#8a52c0", // inspiration
  спокій: "#2a9fb0", // calm
  енергія: "#d4609a", // energy
  тепло: "#bf942a", // warmth
};

// Lowest drive → room that satisfies it.
export const DRIVE_ROOM = {
  натхнення: "art", // inspiration → studio
  енергія: "sleep", // energy → bedroom
  спокій: "bath", // calm → bathroom
  тепло: "kitchen", // warmth → kitchen
};

// Room being acted in → drive it refills (an office visit satisfies warmth).
export const ROOM_DRIVE = {
  art: "натхнення",
  sleep: "енергія",
  bath: "спокій",
  kitchen: "тепло",
  office: "тепло",
};

export const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

// Decay every drive by DECAY (floored at 0).
export function decayDrives(drives) {
  const out = {};
  for (const k of DRIVE_KEYS) out[k] = clamp(drives[k] - DECAY);
  return out;
}

// Refill one drive by REFILL (capped at 100).
export function refillDrive(drives, key) {
  return { ...drives, [key]: clamp(drives[key] + REFILL) };
}

// An action ends once it has run long enough or the drive is essentially full.
export function actionDone(actTicks, driveValue) {
  return actTicks >= ACT_TICKS_MAX || driveValue >= DRIVE_FULL;
}

// Lowest drive's key (ties resolve to DRIVE_KEYS order).
export function lowestDrive(drives) {
  let low = DRIVE_KEYS[0];
  for (const k of DRIVE_KEYS) if (drives[k] < drives[low]) low = k;
  return low;
}

// Pick the OBJECTS target for the lowest drive's room. Special case: when the
// lowest drive is warmth (тепло) and the user is in the office, Лілі comes to
// you — the target becomes the office object.
export function pickTarget(drives, userRoom) {
  const low = lowestDrive(drives);
  let room = DRIVE_ROOM[low];
  if (low === "тепло" && userRoom === "office") room = "office";
  return OBJECTS.find((o) => o.room === room) || null;
}

// ── Navigation (spec §9) ─────────────────────────────────────────────────────
// Breadth-first search over `walkable`; returns the next cell {x,y} on a
// shortest path from start to goal (one step). Returns `start` when start===goal
// or the goal is unreachable. Movement is one cell per tick.
export function bfsNext(start, goal, walkable) {
  if (start.x === goal.x && start.y === goal.y) return { x: start.x, y: start.y };
  const h = walkable.length;
  const w = walkable[0].length;
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const prev = Array.from({ length: h }, () => Array.from({ length: w }, () => null));
  const seen = Array.from({ length: h }, () => Array.from({ length: w }, () => false));
  const NEI = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const q = [start];
  seen[start.y][start.x] = true;
  let found = false;
  for (let i = 0; i < q.length; i++) {
    const cur = q[i];
    if (cur.x === goal.x && cur.y === goal.y) {
      found = true;
      break;
    }
    for (const [dx, dy] of NEI) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!inBounds(nx, ny) || seen[ny][nx] || !walkable[ny][nx]) continue;
      seen[ny][nx] = true;
      prev[ny][nx] = cur;
      q.push({ x: nx, y: ny });
    }
  }
  if (!found) return { x: start.x, y: start.y }; // unreachable
  // Walk the prev-chain back from goal until the cell whose parent is start.
  let node = goal;
  let p = prev[node.y][node.x];
  while (p && !(p.x === start.x && p.y === start.y)) {
    node = p;
    p = prev[node.y][node.x];
  }
  return { x: node.x, y: node.y };
}

// ── Simulation state container ───────────────────────────────────────────────
// The clock starts mid-morning; agent/player position fields are added with the
// tick (HVN-007) and player presence (HVN-010).
export function initialSim() {
  return {
    t: 8 * 60, // minutes into the day (08:00)
    day: 1,
    drives: { ...DRIVES_INIT },
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
