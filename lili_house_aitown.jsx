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
// Import the client-only entry — the package root re-exports a Node-only
// agent-toolset (fs/path) that can't bundle for the browser.
import { Anthropic } from "@anthropic-ai/sdk/client";
import { AuthenticationError, PermissionDeniedError } from "@anthropic-ai/sdk/error";

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
  // Room pools are ambient activity lines (logged as events) — declarative, no
  // questions / direct address.
  office: ["Влаштувалася в кабінеті.", "Тепле світло лампи, тиша.", "Гортаю книжку при лампі."],
  // `you` lines are conversational asides shown only as the speech bubble when
  // you are together — never logged (chat belongs in the chat panel).
  you: ["Я рада, що ти поруч.", "Сумувала за тобою.", "Добре, що ти тут."],
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
export const TICK_MS = 850; // pace of the world tick (always running)
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
  let newLine = null; // ambient activity line → speech bubble AND event log
  let bubbleLine = null; // conversational aside to the user → bubble only (not logged)

  if (lili.acting && target) {
    // 4. acting: refill the target drive, maybe acknowledge the user, then end
    lili.actTicks += 1;
    const driveKey = ROOM_DRIVE[target.room];
    drives = refillDrive(drives, driveKey);
    const r = ROOMS[target.room];
    action = `${r.verb} (${r.name})`;
    if (withYou) {
      if (rng() < 0.5) action = `${r.verb}, з тобою поруч`;
      if (rng() < 0.6) bubbleLine = pickLine(VOICE.you, rng);
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

  // 7. ambient activity lines update the bubble AND the event log; a
  // conversational aside to the user updates only the bubble (chat stays in chat).
  let log = state.log;
  if (newLine && newLine !== "…") {
    voice = newLine;
    log = [...state.log, { t, day, line: newLine }].slice(-LOG_LEN);
  } else if (bubbleLine && bubbleLine !== "…") {
    voice = bubbleLine;
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
  flex: "0 0 auto", // size to content height (cards stack vertically beside the scene)
  borderLeft: `4px solid ${accent}`,
  background: "#fffdf8",
  borderRadius: 8,
  padding: "6px 9px",
  fontSize: 13,
  color: "#3a3530",
  boxShadow: "0 1px 2px #0001",
});

// Compact room-card description: clamp to at most four lines so cards stay short.
const cardDescStyle = {
  marginTop: 2,
  color: "#6b6258",
  fontSize: 12,
  lineHeight: 1.3,
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 4,
  overflow: "hidden",
};

// One agent's drive bars (name + the four 0..100 drives). Shown per agent
// present in the active location.
function AgentDrives({ name, color, drives }) {
  return (
    <div data-agent-drives={name} style={{ minWidth: 170 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, fontSize: 13, color: "#3a3530" }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, display: "inline-block" }} />
        <b>{name}</b>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px", alignItems: "center" }}>
        {DRIVE_KEYS.map((k) => (
          <React.Fragment key={k}>
            <span style={{ fontSize: 12, color: "#4a443c" }}>{k}</span>
            <span data-bar={k} style={{ fontFamily: "ui-monospace, monospace", color: DRIVE_COLORS[k], letterSpacing: 1 }}>
              {barString(drives[k])}
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

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

// ── Chat: frontend Claude client (spec v0.2 §HVN-013) ────────────────────────
// Direct browser call to Anthropic — prototype-only (key in a Vite env var).
// From v1.5 chat moves to POST /chat and the key is server-side only.
export const CHAT_MODEL = "claude-opus-4-8"; // main model for direct chat (single switch point)
export const CHAT_MAX_TOKENS = 300; // replies are short

// Lazily construct the real client so importing the module never requires a key
// (tests always inject a fake client and never hit this path).
let _client = null;
function defaultClient() {
  if (!_client) {
    _client = new Anthropic({
      apiKey: import.meta.env?.VITE_ANTHROPIC_API_KEY,
      dangerouslyAllowBrowser: true,
    });
  }
  return _client;
}

// Ask Лілі: send the history + new user turn under the assembled system prompt
// and return her short reply text. `client` is injectable for offline testing.
export async function askLili({ text, context, history = [], client } = {}) {
  const c = client ?? defaultClient();
  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: text }, // no assistant prefill (removed on 4.x)
  ];
  const resp = await c.messages.create({
    model: CHAT_MODEL,
    max_tokens: CHAT_MAX_TOKENS,
    system: buildSystemPrompt(context),
    messages,
  });
  const block = (resp.content || []).find((b) => b.type === "text");
  return block ? block.text : "";
}

// ── Chat: graceful fallback & voice shaping (spec v0.2 §HVN-015) ─────────────
// Shown when the key is missing (prototype runs offline) and on key/auth errors.
export const OFFLINE_LINE = "Зараз я не на зв'язку… але я поруч із тобою.";
// In-character lines for transient failures (rate limit, network, empty reply).
export const FALLBACK_LINES = [
  "Щось я задумалась… скажеш ще раз?",
  "Вибач, відволіклася на мить. Повториш?",
];

function hasApiKey() {
  return Boolean(import.meta.env?.VITE_ANTHROPIC_API_KEY);
}

// Keep a reply a single short in-character line: strip stray list bullets /
// leading enumerators per line and collapse whitespace. Language is untouched.
export function shapeReply(text) {
  if (!text) return "";
  return String(text)
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Choose a fallback by error kind: key/auth problems → offline line; anything
// transient → a "distracted" line. Uses the SDK's typed errors (and .status).
export function pickFallback(error, rng = Math.random) {
  const keyProblem =
    error instanceof AuthenticationError ||
    error instanceof PermissionDeniedError ||
    error?.status === 401 ||
    error?.status === 403;
  if (keyProblem) return OFFLINE_LINE;
  return FALLBACK_LINES[Math.floor(rng() * FALLBACK_LINES.length)];
}

// Talk to Лілі without ever surfacing a raw error: short-circuit to the offline
// line when there's no key (and no injected client), shape the reply, and turn
// any failure into a short in-character fallback.
export async function safeAskLili({ text, context, history = [], client, ask = askLili, rng = Math.random } = {}) {
  if (!client && !hasApiKey()) return OFFLINE_LINE;
  try {
    const reply = shapeReply(await ask({ text, context, history, client }));
    return reply || pickFallback(null, rng);
  } catch (e) {
    return pickFallback(e, rng);
  }
}

// ── Town map (preview) ───────────────────────────────────────────────────────
// An 8×4 grid where each cell is a location ("scene"), spanning the full width
// below both columns. Only Лілі's house is available now; the rest are named
// placeholders for the future town (ROADMAP v3.1 — with Лілі's mountain/water
// motifs). The grey gaps read as streets.
// available cells are visitable; `loc` ties a cell to a LOCATION you can travel to.
const T = (emoji, label, kind, available = false, loc = null) => ({ emoji, label, kind, available, loc });
export const TOWN = [
  // row 0
  T("🏠", "Дім Лілі", "house", true, "house"), T("🏡", "Сусіди", "house"), T("🏘️", "Котедж", "house"), T("🌳", "Парк", "nature"), T("🌊", "Озеро", "water"), T("⛵", "Набережна", "water"), T("🏔️", "Гори", "mountain"), T("🌲", "Ліс", "nature"),
  // row 1
  T("🏢", "Квартири", "house"), T("🏫", "Школа", "civic"), T("📚", "Книгарня", "shop"), T("☕", "Кафе", "shop", true, "cafe"), T("🥐", "Пекарня", "shop"), T("🛒", "Супермаркет", "shop"), T("🌷", "Сад", "nature"), T("⛰️", "Пагорб", "mountain"),
  // row 2
  T("🏛️", "Музей", "civic"), T("🖼️", "Галерея", "civic"), T("🏥", "Лікарня", "civic"), T("🏦", "Банк", "civic"), T("📮", "Пошта", "civic"), T("💊", "Аптека", "shop"), T("⛲", "Площа", "civic"), T("🌾", "Поле", "nature"),
  // row 3
  T("🏟️", "Стадіон", "civic"), T("🎭", "Театр", "civic"), T("⛪", "Церква", "civic"), T("🚉", "Вокзал", "civic"), T("🌉", "Міст", "water"), T("🏞️", "Річка", "water"), T("🗼", "Маяк", "water"), T("🌊", "Море", "water"),
];

// The town location currently shown as the scene (the one available cell).
export const CURRENT_LOCATION = TOWN.find((c) => c.available) ?? TOWN[0];

const TOWN_BG = {
  house: "#efe6f7",
  shop: "#f6ead2",
  civic: "#dce7f5",
  nature: "#d2e8c6",
  water: "#cfe2ee",
  mountain: "#e6ded3",
};

// Inhabitants of Лілі's house (icon color + name). Reuses the sprite colors.
export const CHARACTERS = [
  { id: "lili", name: LILI_SPRITE.name, color: LILI_SPRITE.body },
  { id: "you", name: YOU_SPRITE.name, color: YOU_SPRITE.body },
];

// Who is in which town cell (cell index = position in TOWN). Лілі and the player
// are home (cell 0); the rest are other inhabitants simulated around the town so
// the map feels alive. Real autonomous agents arrive in v1.3 — for now this is a
// fixed preview of a populated town.
export const TOWN_RESIDENTS = {
  0: CHARACTERS, // 🏠 Дім Лілі — Лілі + ти
  1: [{ id: "oksana", name: "Оксана", color: "#c98a3a" }], // 🏡 Сусіди
  3: [
    // 🌳 Парк
    { id: "nina", name: "Ніна", color: "#4f9a52" },
    { id: "bohdan", name: "Богдан", color: "#5a8f4f" },
  ],
  6: [{ id: "orest", name: "Орест", color: "#7a6a55" }], // 🏔️ Гори
  9: [
    // 🏫 Школа
    { id: "ivan", name: "Іван", color: "#3b6fb0" },
    { id: "solomiya", name: "Соломія", color: "#a05a7a" },
  ],
  10: [{ id: "olya", name: "Оля", color: "#8a6fc0" }], // 📚 Книгарня
  11: [
    // ☕ Кафе
    { id: "marko", name: "Марко", color: "#3a8f6f" },
    { id: "zoya", name: "Зоя", color: "#c07a9a" },
  ],
  13: [
    // 🛒 Супермаркет
    { id: "serhiy", name: "Сергій", color: "#b0593a" },
    { id: "katrya", name: "Катря", color: "#b08a3a" },
  ],
  17: [{ id: "daryna", name: "Дарина", color: "#9a4f7a" }], // 🖼️ Галерея
  18: [{ id: "petro", name: "Петро", color: "#2a8f93" }], // 🏥 Лікарня
  22: [
    // ⛲ Площа — невеликий гурт
    { id: "yuriy", name: "Юрій", color: "#3a6e8f" },
    { id: "myroslava", name: "Мирослава", color: "#9a6f3a" },
    { id: "ostap", name: "Остап", color: "#6f8f3a" },
  ],
  24: [{ id: "taras", name: "Тарас", color: "#6f7ac0" }], // 🏟️ Стадіон
  30: [{ id: "hryts", name: "Гриць", color: "#9a8a3a" }], // 🗼 Маяк
};

// ── Other locations (visitable scenes, v3.1 preview) ─────────────────────────
// Each is a simple bordered open-room map the same grid size as the house, with
// themed props and resident agents that wander. The house keeps its rich drive
// simulation; these are lighter "visit" scenes you can travel to.
function makeLocationWorld({ id, floor, props = [], interior = [3, 2, W - 4, H - 3] }) {
  const [x0, y0, x1, y1] = interior;
  const wallMap = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) => (x >= x0 && x <= x1 && y >= y0 && y <= y1 ? "." : "#")),
  );
  const walkable = wallMap.map((row) => row.map((ch) => ch !== "#"));
  const items = {};
  for (const p of props) items[`${p.x},${p.y}`] = p.glyph;
  return { id, wallMap, walkable, floor, items, interior };
}

// Pick a random walkable cell (rejection sampling; rooms are mostly open).
export function randomWalkable(walkable, rng = Math.random) {
  const h = walkable.length;
  const w = walkable[0].length;
  for (let i = 0; i < 80; i++) {
    const x = Math.floor(rng() * w);
    const y = Math.floor(rng() * h);
    if (walkable[y][x]) return { x, y };
  }
  return { x: 0, y: 0 };
}

// One wander step: head to the current target, pick a new one on arrival, step
// one cell via BFS. Pure (rng injectable). Keeps visit-location agents alive.
export function wanderStep(agent, walkable, rng = Math.random) {
  let target = agent.target;
  if (!target || (agent.x === target.x && agent.y === target.y)) {
    target = randomWalkable(walkable, rng);
  }
  const next = bfsNext({ x: agent.x, y: agent.y }, target, walkable);
  return { ...agent, x: next.x, y: next.y, target };
}

// Visitable locations beyond the house. For now just the café — its own map
// with two inhabitants (Марко, Зоя) who gently wander.
export const LOCATIONS = {
  cafe: {
    id: "cafe",
    name: "Кафе",
    emoji: "☕",
    playerStart: { x: 6, y: 10 },
    agents: [
      { id: "marko", name: "Марко", color: "#3a8f6f", start: { x: 8, y: 5 }, drives: { натхнення: 58, спокій: 74, енергія: 52, тепло: 82 }, thought: "Заварюю каву — ранок тихий і теплий." },
      { id: "zoya", name: "Зоя", color: "#c07a9a", start: { x: 18, y: 6 }, drives: { натхнення: 86, спокій: 48, енергія: 70, тепло: 60 }, thought: "Накидаю ескіз на серветці, поки чекаю." },
    ],
    world: makeLocationWorld({
      id: "cafe",
      floor: "#f1e7c0",
      interior: [4, 3, 24, 11],
      props: [
        { x: 7, y: 4, glyph: "☕" }, { x: 11, y: 4, glyph: "🍰" }, { x: 15, y: 4, glyph: "🪑" },
        { x: 19, y: 4, glyph: "🪑" }, { x: 9, y: 8, glyph: "🫖" }, { x: 16, y: 9, glyph: "🪴" },
        { x: 22, y: 6, glyph: "🪟" },
      ],
    }),
  },
};

// Display metadata for the active-location header (house + the café).
export const LOCATION_META = {
  house: { emoji: "🏠", name: "Дім Лілі" },
  cafe: { emoji: "☕", name: "Кафе" },
};

// Initial visit state when entering a location: the player at the start cell and
// the location's agents at their starting cells (they wander from there).
export function makeVisit(locId) {
  const loc = LOCATIONS[locId];
  return {
    id: locId,
    player: { ...loc.playerStart },
    agents: (loc.agents || []).map((a) => ({ ...a, x: a.start.x, y: a.start.y, target: null })),
  };
}

// A visit scene: tiles (single floor color), props, the location's agents
// (sprite + name tag), and the player.
export function LocationScene({ world, agents = [], player, dayT = 0 }) {
  const tiles = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (world.wallMap[y][x] === "#") {
        tiles.push(
          <g key={`t${x},${y}`}>
            <rect x={x * TILE} y={y * TILE} width={TILE} height={TILE} fill={WALL_BASE} />
            <rect x={x * TILE} y={y * TILE} width={TILE} height={4} fill={WALL_TOP} />
          </g>,
        );
      } else {
        tiles.push(
          <rect
            key={`t${x},${y}`}
            x={x * TILE}
            y={y * TILE}
            width={TILE}
            height={TILE}
            fill={world.floor}
            stroke="#00000010"
            strokeWidth="1"
          />,
        );
      }
    }
  }
  const props = Object.entries(world.items).map(([key, glyph]) => {
    const [px, py] = key.split(",").map(Number);
    return (
      <text key={`i${key}`} x={px * TILE + TILE / 2} y={py * TILE + TILE * 0.72} textAnchor="middle" fontSize={TILE * 0.72}>
        {glyph}
      </text>
    );
  });
  return (
    <svg
      viewBox={`0 0 ${SW} ${SH}`}
      width="100%"
      style={{ display: "block", background: PALETTE.surround, borderRadius: 8 }}
      role="img"
      aria-label="Локація"
    >
      <g data-layer="tiles">{tiles}</g>
      <g data-layer="props">{props}</g>
      <rect x={0} y={0} width={SW} height={SH} fill={NIGHT_TINT} opacity={dayNightOpacity(dayT)} style={{ pointerEvents: "none" }} data-layer="daynight" />
      {agents.map((a) => (
        <Sprite key={a.id} x={a.x} y={a.y} body={a.color} hair="#3a2f2a" name={a.name} dur={0.6} />
      ))}
      <Sprite x={player.x} y={player.y} {...YOU_SPRITE} dur={GLIDE_YOU} />
    </svg>
  );
}

export function TownMap({ active = "house", onTravel } = {}) {
  return (
    <div data-town style={{ marginTop: 14 }}>
      <div style={{ fontSize: 14, color: "#3a3530" }}>Карта міста</div>
      <div style={{ fontSize: 12, color: "#8a8276", margin: "2px 0 8px" }}>
        Натисніть доступну локацію, щоб перейти. Зараз відкриті: Дім Лілі та Кафе.
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(8, 1fr)",
          gap: 6,
          background: "#c2c6cb", // вулиці (проміжки між кварталами)
          padding: 6,
          borderRadius: 10,
        }}
      >
        {TOWN.map((c, i) => {
          const residents = TOWN_RESIDENTS[i] || [];
          const travelable = !!c.loc;
          const isActive = travelable && c.loc === active;
          const go = travelable && onTravel ? () => onTravel(c.loc) : undefined;
          return (
            <div
              key={i}
              data-town-cell={c.kind}
              data-available={c.available ? "true" : "false"}
              data-loc={c.loc || undefined}
              data-active={isActive ? "true" : undefined}
              role={travelable ? "button" : undefined}
              tabIndex={travelable ? 0 : undefined}
              onClick={go}
              onKeyDown={go ? (e) => (e.key === "Enter" || e.key === " ") && go() : undefined}
              title={travelable ? (isActive ? `${c.label} — ви тут` : `${c.label} — перейти`) : c.label}
              style={{
                position: "relative",
                minHeight: 62,
                borderRadius: 7,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                padding: "4px 2px",
                cursor: travelable ? "pointer" : "default",
                background: c.available ? "#e7d8f5" : TOWN_BG[c.kind] || "#e9e6e0",
                border: isActive
                  ? "2px solid #7a52b0"
                  : travelable
                    ? "2px solid #b48fd0"
                    : "1px solid #00000012",
                boxShadow: isActive ? "0 0 0 3px #7a52b033" : "none",
                opacity: c.available ? 1 : 0.92,
                color: "#3a3530",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>{c.emoji}</span>
              <span
                style={{
                  fontSize: 8.5,
                  lineHeight: 1.05,
                  fontWeight: c.available ? 700 : 400,
                  padding: "0 2px",
                  wordBreak: "break-word",
                }}
              >
                {c.label}
              </span>
              {residents.length > 0 && (
                <div
                  data-residents
                  style={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center" }}
                >
                  {residents.map((r) => (
                    <span
                      key={r.id}
                      data-resident={r.id}
                      title={r.name}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 2,
                        background: "#ffffffcc",
                        borderRadius: 7,
                        padding: "0 3px",
                        fontSize: 8,
                        lineHeight: 1.4,
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: r.color,
                          display: "inline-block",
                        }}
                      />
                      {r.name}
                    </span>
                  ))}
                </div>
              )}
              <span style={{ position: "absolute", top: 2, right: 3, fontSize: 9 }}>
                {isActive ? "📍" : travelable ? "🚪" : "🔒"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function LiliHouseAITown({ chat = safeAskLili } = {}) {
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

  // Which location is shown: "house" (the rich home sim) or a visit location
  // (e.g. "cafe"). `visit` holds the player's position in the visit scene.
  const [activeLocation, setActiveLocation] = useState("house");
  const [visit, setVisit] = useState(null);
  const travel = useCallback((locId) => {
    if (locId === "house") {
      setActiveLocation("house");
      setVisit(null);
    } else if (LOCATIONS[locId]) {
      setActiveLocation(locId);
      setVisit(makeVisit(locId));
    }
  }, []);

  // One tick of the world: advance the pure reducer with live RNG.
  const doTick = useCallback(() => {
    setSim((s) => advance(s, { walkable, roomAt, rng: Math.random }));
  }, [walkable, roomAt]);

  // Continuous life: the world always ticks — no pause/play/step (the
  // characters live whether or not the user interacts; MISSION.md).
  useEffect(() => {
    const id = setInterval(doTick, TICK_MS);
    return () => clearInterval(id);
  }, [doTick]);

  // Visit-location life: gently wander the location's agents while you're there.
  useEffect(() => {
    if (activeLocation === "house") return undefined;
    const w = LOCATIONS[activeLocation].world.walkable;
    const id = setInterval(() => {
      setVisit((v) => (v ? { ...v, agents: v.agents.map((a) => wanderStep(a, w, Math.random)) } : v));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [activeLocation]);

  // Player movement: arrows/WASD step the user one walkable cell, ignored while
  // a text field is focused. Feeds sim.you, which the tick reads for `withYou`
  // and the warmth→office case.
  useEffect(() => {
    const onKey = (e) => {
      if (isTypingTarget(e.target)) return;
      const dir = dirForKey(e.key);
      if (!dir) return;
      e.preventDefault();
      if (activeLocation === "house") {
        setSim((s) => ({ ...s, you: tryMove(s.you, dir, walkable) }));
      } else {
        const w = LOCATIONS[activeLocation].world.walkable;
        setVisit((v) => (v ? { ...v, player: tryMove(v.player, dir, w) } : v));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeLocation, walkable]);

  // Chat with Лілі (v0.2). `history` is the transcript; sending grounds the reply
  // in the live context from simRef.current (her room/action at the moment you ask).
  const [history, setHistory] = useState([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const chatOffline = !hasApiKey(); // no key → Лілі answers with the offline line

  const send = useCallback(
    async (e) => {
      if (e) e.preventDefault();
      const text = draft.trim();
      if (!text || pending) return;
      const prior = history; // history before this turn — askLili appends the user turn
      setHistory((h) => [...h, { role: "user", content: text }]);
      setDraft("");
      setPending(true);
      try {
        const reply = await chat({
          text,
          context: liveContext(simRef.current, roomAt),
          history: prior,
        });
        setHistory((h) => [...h, { role: "assistant", content: reply }]);
      } finally {
        setPending(false);
      }
    },
    [draft, pending, history, chat, roomAt],
  );

  // Room cards ("who sees what") — sit above the chat in the right column.
  // Agents in the active location: their drives + a current thought/observation
  // (the player isn't an autonomous agent). House → Лілі; visit loc → its agents.
  const liliRoom = roomAt(sim.lili.x, sim.lili.y);
  const agentsHere =
    activeLocation === "house"
      ? [
          {
            id: "lili",
            name: LILI_SPRITE.name,
            color: LILI_SPRITE.body,
            drives: sim.drives,
            place: ROOMS[liliRoom].name,
            thought: sim.voice && sim.voice !== "…" ? sim.voice : "Тут спокійно — можна побути собою.",
          },
        ]
      : (visit?.agents ?? []).map((a) => ({ ...a, place: LOCATION_META[activeLocation].name }));

  // Thought / observation cards for the agents currently in this location.
  const thoughtCards = agentsHere.map((a) => (
    <div key={a.id} data-card={a.id} style={cardStyle(a.color)}>
      <b style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: a.color, display: "inline-block" }} />
        {a.name} · {a.place}
      </b>
      <div style={{ ...cardDescStyle, fontStyle: "italic" }}>💭 {a.thought}</div>
    </div>
  ));

  return (
    <div
      style={{
        background: PALETTE.page,
        minHeight: "100%",
        padding: 16,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {/* Scene + panels (left) and chat (right); town map spans full width below */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          {/* ── Left column: the world + simulation panel ── */}
          <div style={{ flex: "1 1 520px", minWidth: 0 }}>
          {/* Which town-map location this scene is */}
          <div
            data-location
            style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 15, color: "#3a3530" }}
          >
            <span aria-hidden>{LOCATION_META[activeLocation].emoji}</span>
            <b>{LOCATION_META[activeLocation].name}</b>
            <span style={{ color: "#8a8276", fontSize: 12 }}>· локація на карті · ви тут</span>
            {activeLocation !== "house" && (
              <button onClick={() => travel("house")} style={{ marginLeft: "auto", fontSize: 12 }}>
                ← Дім Лілі
              </button>
            )}
          </div>
          {activeLocation === "house" || !visit ? (
            <Scene
              sim={sim}
              wallMap={wallMap}
              roomAt={roomAt}
              liliDur={GLIDE_LILI}
              youDur={GLIDE_YOU}
            />
          ) : (
            <LocationScene
              world={LOCATIONS[activeLocation].world}
              agents={visit.agents}
              player={visit.player}
              dayT={sim.t}
            />
          )}

          {/* Clock — the world lives continuously; no pause/step/play controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 10,
              color: "#6b6258",
              fontSize: 14,
            }}
          >
            <span style={{ color: "#3a9b5c" }} aria-hidden>
              ●
            </span>
            <span>наживо</span>
            <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
              День {sim.day} · {fmtTime(sim.t)}
            </span>
          </div>

          {/* Action line (Лілі, while you're home) */}
          {activeLocation === "house" && (
            <div data-action style={{ marginTop: 12, fontSize: 14, color: "#3a3530" }}>
              ▸ {sim.action ? `Лілі ${sim.action}` : "…"}
            </div>
          )}

          {/* Drives for every agent currently in this location */}
          <div
            data-panel="drives"
            style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 10 }}
          >
            {agentsHere.map((a) => (
              <AgentDrives key={a.id} name={a.name} color={a.color} drives={a.drives} />
            ))}
          </div>

          {/* Movement hint */}
          <div style={{ marginTop: 10, fontSize: 12, color: "#8a8276" }}>
            Рухайтесь: ← ↑ → ↓ або WASD · напишіть Лілі праворуч
          </div>
        </div>

        {/* ── Right column: what each sees, above the chat ── */}
        <div
          style={{
            flex: "1 1 300px",
            minWidth: 260,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* Thoughts / observations of the agents in this location */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{thoughtCards}</div>

          {/* Chat panel (v0.2) — talk to Лілі; she answers grounded in her state */}
          <div
            data-panel="chat"
            style={{
              border: "1px solid #e3dcc9",
              borderRadius: 10,
              background: "#fffdf8",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              data-chat="transcript"
              style={{
                maxHeight: 640,
                minHeight: 280,
                overflowY: "auto",
                padding: 10,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: 13,
              }}
            >
              {chatOffline && (
                <div data-chat="offline-note" style={{ color: "#b08a3a", fontSize: 12 }}>
                  Чат офлайн — додайте <code>VITE_ANTHROPIC_API_KEY</code> у <code>.env</code>, щоб Лілі відповідала.
                </div>
              )}
              {history.length === 0 && (
                <div style={{ color: "#a59c8c" }}>Поговоріть з Лілі — вона відповість залежно від того, де вона й що робить.</div>
              )}
              {history.map((m, i) => (
                <div
                  key={i}
                  data-role={m.role}
                  style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      padding: "5px 9px",
                      borderRadius: 10,
                      background: m.role === "user" ? "#dceaf6" : "#f0e6f4",
                      color: "#3a3530",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {m.content}
                  </span>
                </div>
              ))}
              {pending && (
                <div data-chat="typing" style={{ alignSelf: "flex-start", color: "#a08fb0", fontStyle: "italic" }}>
                  Лілі друкує…
                </div>
              )}
            </div>
            <form onSubmit={send} style={{ display: "flex", gap: 6, padding: 8, borderTop: "1px solid #efe8d8" }}>
              <input
                data-chat-input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={pending}
                placeholder="Напишіть Лілі…"
                aria-label="Повідомлення для Лілі"
                style={{
                  flex: 1,
                  border: "1px solid #d9cdae",
                  borderRadius: 8,
                  padding: "6px 9px",
                  fontSize: 13,
                  background: pending ? "#f3efe6" : "#fff",
                }}
              />
              <button type="submit" disabled={pending || !draft.trim()}>
                Надіслати
              </button>
            </form>
          </div>
        </div>
        </div>

        {/* Town map — full width, below both columns; click a location to travel */}
        <TownMap active={activeLocation} onTravel={travel} />
      </div>
    </div>
  );
}
