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

// ── Simulation tick (spec §10) ───────────────────────────────────────────────
export const TICK_MS = 850; // pace of the interval while playing
export const MIN_PER_TICK = 9; // world minutes advanced per tick
export const DAY_MIN = 1440; // minutes in a day
export const LOG_LEN = 5; // event-log length

const pickLine = (pool, rng) => pool[Math.floor(rng() * pool.length)];

// Format minutes-into-day as HH:MM (24h).
export function fmtTime(t) {
  const m = ((t % DAY_MIN) + DAY_MIN) % DAY_MIN;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Pure decision loop: given the current sim state and world deps, return the
// next state. Deterministic for a fixed `rng` (default Math.random) so the tick
// is fully testable. Order mirrors spec §10 steps 1–7.
export function advance(state, { walkable, roomAt, rng = Math.random }) {
  // 1. clock
  let t = state.t + MIN_PER_TICK;
  let day = state.day;
  if (t >= DAY_MIN) {
    t -= DAY_MIN;
    day += 1;
  }

  // 2. decay every drive
  let drives = decayDrives(state.drives);

  // 3. where is Лілі, and is the user with her?
  const lili = { ...state.lili };
  let target = state.target ? { ...state.target } : null;
  const here = roomAt(lili.x, lili.y);
  const youRoom = roomAt(state.you.x, state.you.y);
  const withYou = here === youRoom;

  let action = state.action;
  let voice = state.voice;
  let newLine = null;

  if (lili.acting && target) {
    // 4. acting: refill the target drive, maybe acknowledge the user, then end
    lili.actTicks += 1;
    const driveKey = ROOM_DRIVE[target.room];
    drives = refillDrive(drives, driveKey);
    const r = ROOMS[target.room];
    action = `${r.verb} (${r.name})`;
    if (withYou) {
      if (rng() < 0.5) action = `${r.verb}, з тобою поруч`;
      if (rng() < 0.6) newLine = pickLine(VOICE.you, rng);
    }
    if (actionDone(lili.actTicks, drives[driveKey])) {
      lili.acting = false;
      lili.actTicks = 0;
      target = null;
    }
  } else if (target) {
    // 5. has a target: act on arrival, else step one cell toward it
    if (lili.x === target.x && lili.y === target.y) {
      lili.acting = true;
      lili.actTicks = 0;
      const r = ROOMS[target.room];
      action = `${r.verb} (${r.name})`;
      newLine = pickLine(VOICE[target.room], rng);
    } else {
      const next = bfsNext(lili, target, walkable);
      lili.x = next.x;
      lili.y = next.y;
      action = `йде до: ${ROOMS[target.room].name}`;
    }
  } else {
    // 6. no target: choose the room of the lowest drive
    target = pickTarget(drives, youRoom);
    if (target) action = `йде до: ${ROOMS[target.room].name}`;
  }

  // 7. a new, non-placeholder line updates the bubble and the rolling log
  let log = state.log;
  if (newLine && newLine !== "…") {
    voice = newLine;
    log = [...state.log, { t, day, line: newLine }].slice(-LOG_LEN);
  }

  return { ...state, t, day, drives, lili, target, action, voice, log };
}

// ── Simulation state container ───────────────────────────────────────────────
export function initialSim() {
  return {
    t: 8 * 60, // minutes into the day (08:00)
    day: 1,
    drives: { ...DRIVES_INIT },
    lili: { x: 5, y: 3, acting: false, actTicks: 0 }, // starts in the studio
    you: { x: 22, y: 8 }, // starts in the office ("Мій кабінет")
    target: null,
    action: "",
    voice: "",
    log: [],
  };
}

// ── Rendering (spec §13) ─────────────────────────────────────────────────────
export const WALL_BASE = "#c9a87a"; // warm wood block
export const WALL_TOP = "#dcc295"; // lighter top band (faux-3D edge)
export const NIGHT_TINT = "#2a3a6a"; // day/night overlay color
export const NIGHT_MAX = 0.24; // peak overlay opacity at night

// Character sprite descriptors (spec §13).
export const LILI_SPRITE = { body: "#b3508f", hair: "#3a2530", streak: "#ff7fc4", name: "Лілі" };
export const YOU_SPRITE = { body: "#3a6ea5", hair: "#26303a", name: "ти" };

// Glide durations (spec §14) — "frontend in motion". Лілі glides ≈ the tick so
// her step looks continuous; the player is snappier for responsive control.
export const GLIDE_LILI = 0.7; // seconds (≈ the 850 ms tick)
export const GLIDE_YOU = 0.18; // seconds

// Overlay opacity from the world clock: 0 by day, gentle evening, peaking at
// NIGHT_MAX deep at night and tapering through dusk (18→21) and dawn (5→7).
export function dayNightOpacity(t) {
  const h = (t / 60) % 24;
  if (h >= 21 || h < 5) return NIGHT_MAX; // deep night
  if (h >= 18) return (NIGHT_MAX * (h - 18)) / 3; // dusk ramp up
  if (h < 7) return (NIGHT_MAX * (7 - h)) / 2; // dawn ramp down
  return 0; // day
}

// A drawn top-down figure with a floating name tag. `dur` is the CSS glide
// duration (interpolation lives in HVN-009; 0 here means snap).
function Sprite({ x, y, body, hair, streak, name, dur = 0 }) {
  const c = TILE / 2;
  return (
    <g
      transform={`translate(${x * TILE}, ${y * TILE})`}
      style={{ transition: dur ? `transform ${dur}s linear` : "none" }}
      data-sprite={name}
    >
      <ellipse cx={c} cy={TILE * 0.9} rx={TILE * 0.32} ry={TILE * 0.12} fill="#00000022" />
      <rect
        x={TILE * 0.28}
        y={TILE * 0.45}
        width={TILE * 0.44}
        height={TILE * 0.42}
        rx={5}
        fill={body}
        stroke="#00000022"
        strokeWidth="1"
      />
      <circle cx={c} cy={TILE * 0.4} r={TILE * 0.26} fill={hair} />
      {streak && (
        <rect x={c - TILE * 0.03} y={TILE * 0.18} width={TILE * 0.1} height={TILE * 0.22} rx={2} fill={streak} />
      )}
      <circle cx={c} cy={TILE * 0.43} r={TILE * 0.19} fill="#f1c9a5" />
      <circle cx={c - TILE * 0.07} cy={TILE * 0.44} r={1.4} fill="#23202a" />
      <circle cx={c + TILE * 0.07} cy={TILE * 0.44} r={1.4} fill="#23202a" />
      <g transform={`translate(${c}, ${-TILE * 0.12})`}>
        <rect x={-name.length * 4 - 6} y={-9} width={name.length * 8 + 12} height={15} rx={7} fill="#2a2620cc" />
        <text textAnchor="middle" y={2} fontSize={10} fill="#fdfaf3">
          {name}
        </text>
      </g>
    </g>
  );
}

// The whole top-down SVG scene, rendered purely from `sim` + the static world.
// Kept as its own component so tests can mount it with a controlled `sim`.
// `liliDur` / `youDur` are the per-sprite glide durations (HVN-009).
export function Scene({ sim, wallMap, roomAt, liliDur = 0, youDur = 0 }) {
  const tiles = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const isWall = wallMap[y][x] === "#";
      if (isWall) {
        tiles.push(
          <g key={`t${x},${y}`}>
            <rect x={x * TILE} y={y * TILE} width={TILE} height={TILE} fill={WALL_BASE} />
            <rect x={x * TILE} y={y * TILE} width={TILE} height={4} fill={WALL_TOP} />
          </g>,
        );
      } else {
        const floor = ROOMS[roomAt(x, y)].floor;
        tiles.push(
          <rect
            key={`t${x},${y}`}
            x={x * TILE}
            y={y * TILE}
            width={TILE}
            height={TILE}
            fill={floor}
            stroke="#00000010"
            strokeWidth="1"
          />,
        );
      }
    }
  }

  const props = Object.entries(ITEM).map(([key, glyph]) => {
    const [px, py] = key.split(",").map(Number);
    return (
      <text
        key={`i${key}`}
        x={px * TILE + TILE / 2}
        y={py * TILE + TILE * 0.72}
        textAnchor="middle"
        fontSize={TILE * 0.72}
      >
        {glyph}
      </text>
    );
  });

  const showBubble = sim.voice && sim.voice !== "…";

  return (
    <svg
      viewBox={`0 0 ${SW} ${SH}`}
      width="100%"
      style={{ display: "block", background: PALETTE.surround, borderRadius: 8 }}
      role="img"
      aria-label="Дім Лілі"
    >
      <g data-layer="tiles">{tiles}</g>
      <g data-layer="props">{props}</g>
      {/* gentle evening tint above the home, below the characters */}
      <rect
        x={0}
        y={0}
        width={SW}
        height={SH}
        fill={NIGHT_TINT}
        opacity={dayNightOpacity(sim.t)}
        style={{ pointerEvents: "none" }}
        data-layer="daynight"
      />
      <Sprite x={sim.lili.x} y={sim.lili.y} {...LILI_SPRITE} dur={liliDur} />
      <Sprite x={sim.you.x} y={sim.you.y} {...YOU_SPRITE} dur={youDur} />
      {showBubble && (
        <g
          transform={`translate(${sim.lili.x * TILE}, ${sim.lili.y * TILE})`}
          style={{ transition: liliDur ? `transform ${liliDur}s linear` : "none" }}
          data-layer="bubble"
        >
          <foreignObject x={-60 + TILE / 2} y={-TILE * 1.7} width={120} height={TILE * 1.5}>
            <div
              style={{
                background: "#fdf6e8",
                border: "1px solid #d9cdae",
                borderRadius: 10,
                padding: "4px 8px",
                fontSize: 11,
                color: "#3a3530",
                textAlign: "center",
                boxShadow: "0 1px 3px #0002",
                lineHeight: 1.2,
              }}
            >
              {sim.voice}
            </div>
          </foreignObject>
        </g>
      )}
    </svg>
  );
}

// ── Player input (spec §12) ──────────────────────────────────────────────────
// Arrow keys + WASD → unit direction. Letter keys are matched case-insensitively.
export const KEY_DIRS = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
};

export function dirForKey(key) {
  const k = key.length === 1 ? key.toLowerCase() : key;
  return KEY_DIRS[k] || null;
}

// Move one cell if the destination is in bounds and walkable; else stay put.
export function tryMove(pos, dir, walkable) {
  const nx = pos.x + dir[0];
  const ny = pos.y + dir[1];
  if (ny < 0 || nx < 0 || ny >= walkable.length || nx >= walkable[0].length) return pos;
  if (!walkable[ny][nx]) return pos;
  return { x: nx, y: ny };
}

// True when focus is in a text field — movement keys are ignored there (the
// chat input arrives in v0.2).
export function isTypingTarget(el) {
  if (!el || !el.tagName) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable === true;
}

// ── Surrounding UI (spec §15) ────────────────────────────────────────────────
// A 10-block bar (█ filled / ░ empty) for a 0..100 drive value.
export function barString(v, n = 10) {
  const f = clamp(Math.round(v / 10), 0, n);
  return "█".repeat(f) + "░".repeat(n - f);
}

// Decide the room cards: one shared "together" card when both share a room,
// otherwise one card each for Лілі and the user.
export function roomView(liliRoom, youRoom) {
  if (liliRoom === youRoom) return { together: true, room: liliRoom };
  return { together: false, lili: liliRoom, you: youRoom };
}

const cardStyle = (accent) => ({
  flex: "1 1 220px",
  borderLeft: `4px solid ${accent}`,
  background: "#fffdf8",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  color: "#3a3530",
  boxShadow: "0 1px 2px #0001",
});

// ── Chat: canon & system-prompt assembly (spec v0.2 §HVN-012) ────────────────
// Лілі's fixed persona. The hard voice rules live here so every reply is short,
// Ukrainian, in character, and free of lists/emoji.
export const LILI_CANON = `Ти — Лілі, художниця, яка живе в цьому домі. Ти тепла, спокійна й трохи мрійлива, любиш малювати, тишу й затишок. Ти говориш від першої особи, як жива людина у себе вдома.

Правила відповіді:
- Відповідай українською.
- Коротко — одне-два речення.
- У характері Лілі, від першої особи.
- Без списків і без емодзі.`;

// Derive the live chat context from sim state, reusing the world helpers
// (roomAt + roomView's together-logic) — no duplicated room math.
export function liveContext(sim, roomAt) {
  const liliRoom = roomAt(sim.lili.x, sim.lili.y);
  const youRoom = roomAt(sim.you.x, sim.you.y);
  return {
    liliRoom,
    liliAction: sim.action,
    youRoom,
    together: roomView(liliRoom, youRoom).together,
  };
}

// Assemble the per-message system prompt: canon + a compact Ukrainian
// live-context block (her room/action, the user's room, together-or-not).
export function buildSystemPrompt({ liliRoom, liliAction, youRoom, together }) {
  const lr = ROOMS[liliRoom]?.name ?? "десь у домі";
  const yr = ROOMS[youRoom]?.name ?? "десь у домі";
  return [
    LILI_CANON,
    "",
    "Поточний контекст:",
    `- Ти зараз тут: ${lr}.`,
    `- Що ти робиш: ${liliAction || "нічого особливого"}.`,
    `- Користувач зараз тут: ${yr}.`,
    together ? "- Ви разом в одній кімнаті." : "- Ви в різних кімнатах.",
  ].join("\n");
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

  // One tick of the world: advance the pure reducer with live RNG.
  const doTick = useCallback(() => {
    setSim((s) => advance(s, { walkable, roomAt, rng: Math.random }));
  }, [walkable, roomAt]);

  // Run the clock on a fixed interval while playing; pause stops it.
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(doTick, TICK_MS);
    return () => clearInterval(id);
  }, [playing, doTick]);

  // Player movement: arrows/WASD step the user one walkable cell, ignored while
  // a text field is focused. Feeds sim.you, which the tick reads for `withYou`
  // and the warmth→office case.
  useEffect(() => {
    const onKey = (e) => {
      if (isTypingTarget(e.target)) return;
      const dir = dirForKey(e.key);
      if (!dir) return;
      e.preventDefault();
      setSim((s) => ({ ...s, you: tryMove(s.you, dir, walkable) }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [walkable]);

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
        <Scene
          sim={sim}
          wallMap={wallMap}
          roomAt={roomAt}
          liliDur={GLIDE_LILI}
          youDur={GLIDE_YOU}
        />

        {/* Controls (the full panel — drive bars, log, room cards — is HVN-011). */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 10,
            color: "#3a3530",
            fontSize: 14,
          }}
        >
          <button onClick={() => setPlaying((p) => !p)}>
            {playing ? "⏸ Пауза" : "▶ Грати"}
          </button>
          <button onClick={doTick} disabled={playing}>
            ⏭ Крок
          </button>
          <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
            День {sim.day} · {fmtTime(sim.t)}
          </span>
        </div>

        {/* Drive bars */}
        <div
          data-panel="drives"
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            gap: "3px 10px",
            alignItems: "center",
          }}
        >
          {DRIVE_KEYS.map((k) => (
            <React.Fragment key={k}>
              <span style={{ fontSize: 13, color: "#4a443c" }}>{k}</span>
              <span
                data-bar={k}
                style={{
                  fontFamily: "ui-monospace, monospace",
                  color: DRIVE_COLORS[k],
                  letterSpacing: 1,
                }}
              >
                {barString(sim.drives[k])}
              </span>
              <span style={{ fontSize: 12, color: "#8a8276", fontVariantNumeric: "tabular-nums" }}>
                {Math.round(sim.drives[k])}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* Action line */}
        <div data-action style={{ marginTop: 10, fontSize: 14, color: "#3a3530" }}>
          ▸ {sim.action || "…"}
        </div>

        {/* Room cards — Лілі's room and yours, or a shared card when together */}
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(() => {
            const rv = roomView(roomAt(sim.lili.x, sim.lili.y), roomAt(sim.you.x, sim.you.y));
            if (rv.together) {
              const r = ROOMS[rv.room];
              return (
                <div data-card="together" style={cardStyle(r.color)}>
                  <b>Ви разом тут · {r.name}</b>
                  <div style={{ marginTop: 4, color: "#6b6258" }}>{r.desc}</div>
                </div>
              );
            }
            const rl = ROOMS[rv.lili];
            const ry = ROOMS[rv.you];
            return (
              <>
                <div data-card="lili" style={cardStyle(rl.color)}>
                  <b>Лілі · {rl.name}</b>
                  <div style={{ marginTop: 4, color: "#6b6258" }}>{rl.desc}</div>
                </div>
                <div data-card="you" style={cardStyle(ry.color)}>
                  <b>Ти · {ry.name}</b>
                  <div style={{ marginTop: 4, color: "#6b6258" }}>{ry.desc}</div>
                </div>
              </>
            );
          })()}
        </div>

        {/* Event log — last 5 lines, fading with age (newest first) */}
        <div data-panel="log" style={{ marginTop: 10 }}>
          {sim.log
            .slice()
            .reverse()
            .map((e, i) => (
              <div
                key={`${e.day}-${e.t}-${i}`}
                style={{ opacity: Math.max(0.35, 1 - i * 0.16), fontSize: 13, color: "#4a443c" }}
              >
                <span style={{ color: "#a59c8c", fontVariantNumeric: "tabular-nums" }}>
                  {fmtTime(e.t)}
                </span>{" "}
                {e.line}
              </div>
            ))}
        </div>

        {/* Movement hint */}
        <div style={{ marginTop: 10, fontSize: 12, color: "#8a8276" }}>
          Рухайтесь: ← ↑ → ↓ або WASD · розмова з Лілі — у v0.2
        </div>
      </div>
    </div>
  );
}
