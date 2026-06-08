# Version v0 — Issues (phase v0.1)

Fine-grained breakdown of **ROADMAP §v0.1 — Graphical home and autonomous Лілі** into `HVN-xxx` issues. Every concrete value is taken from [PROTOTYPE_PHASE1_SPEC.md](../../PROTOTYPE_PHASE1_SPEC.md); the phase Goal/DoD is [ROADMAP §v0.1](../../ROADMAP.md). This phase is a **single self-contained React file** `lili_house_aitown.jsx` (default component `LiliHouseAITown`), **no backend**. All issues are `area:frontend`. In-app strings (room names, voice) are **Ukrainian** by design.

Phase DoD (the acceptance bar all issues serve): *Лілі autonomously glides room to room by her drives; you move your own character smoothly; interior descriptions update for both her room and yours; no teleporting.*

> Scope note: this file covers **v0.1 only**. The v0.2 (in-character chat) issues are added later, before uploading v0.2.

## Issues Summary Table

| ID | Title | Size | Area | Phase | Dependencies |
|----|-------|------|------|-------|--------------|
| HVN-001 | Project scaffold & technical basis | S | frontend | v0.1 | — |
| HVN-002 | World floor plan (`computeWallMap`) | M | frontend | v0.1 | HVN-001 |
| HVN-003 | Derived grids (`walkable`, `roomGrid`, `roomAt`) | S | frontend | v0.1 | HVN-002 |
| HVN-004 | Rooms, objects, decor & voice config | M | frontend | v0.1 | HVN-002 |
| HVN-005 | Drives & target selection (`pickTarget`) | M | frontend | v0.1 | HVN-003, HVN-004 |
| HVN-006 | BFS navigation (`bfsNext`) | S | frontend | v0.1 | HVN-003 |
| HVN-007 | Simulation tick & pause/step controls (`tick`) | L | frontend | v0.1 | HVN-004, HVN-005, HVN-006 |
| HVN-008 | SVG scene rendering (tiles, props, sprites, bubble, day/night) | L | frontend | v0.1 | HVN-003, HVN-004, HVN-007 |
| HVN-009 | Smooth sprite interpolation (no teleporting) | S | frontend | v0.1 | HVN-008 |
| HVN-010 | Player presence & keyboard movement | M | frontend | v0.1 | HVN-007, HVN-008 |
| HVN-011 | Surrounding UI (drive bars, action line, room cards, event log) | M | frontend | v0.1 | HVN-005, HVN-007 |

Dependency order (topological): HVN-001 → 002 → {003, 004} → {005, 006} → 007 → 008 → {009, 010, 011}.

---

## HVN-001: Project scaffold & technical basis

**Description**
Stand up the single-file React prototype that the rest of v0.1 fills in. This is the foundation issue — it establishes the file, the component, the grid/scene constants, the palette, and the simulation-state container. No world logic yet.

**What needs to be done**
- Create the frontend app shell hosting one self-contained file `lili_house_aitown.jsx` with a default export component `LiliHouseAITown`.
- Define the grid constants: `W = 29` (columns), `H = 15` (rows), `TILE = 24` (px/cell).
- Derive scene size `SW = W*TILE = 696`, `SH = H*TILE = 360`; render the scene as an SVG with `viewBox="0 0 696 360"` and `width: 100%` so it scales to the container.
- Set up simulation state in `useState` (`sim`) plus an async mirror `simRef` (a ref kept in sync) for use inside `setInterval`/async callbacks.
- Apply the AI Town palette: page background `#f3efe6` (warm cream); scene surround `#bcd9b0` (soft grass, visible above the house where the speech bubble floats).

**Dependencies**
None — this is the foundation.

**Expected result**
The app builds and renders an empty scaled SVG canvas (696×360 viewBox) on the cream page with the grass surround; `sim`/`simRef` exist and are wired.

**Acceptance criteria**
- [ ] `lili_house_aitown.jsx` exports `LiliHouseAITown` as the default component and renders without errors.
- [ ] `W=29`, `H=15`, `TILE=24`; the SVG uses `viewBox="0 0 696 360"` and `width:100%`.
- [ ] `sim` (`useState`) and `simRef` (async mirror) are defined and stay in sync.
- [ ] Page background `#f3efe6` and scene surround `#bcd9b0` are applied.

---

## HVN-002: World floor plan (`computeWallMap`)

**Description**
Build the procedural floor plan: an `H×W` character grid filled with walls, into which the six rooms are carved and the doors opened, with the hall as the connecting spine.

**What needs to be done**
- Implement `computeWallMap`: start from an `H×W` array filled with wall `#`, and carve room rectangles with a helper `rect(x0,y0,x1,y1,ch)` (inclusive coordinates).
- Carve the six rooms at exactly these interiors (char → cols x / rows y, inclusive):
  - `A` — Майстерня Лілі (studio): cols **1–10**, rows **1–6** (large)
  - `K` — Кухня (kitchen): cols **1–10**, rows **8–13** (large)
  - `H` — Хол (hall, hub-spine): cols **12–15**, rows **1–13** (vertical corridor)
  - `S` — Наша спальня (bedroom): cols **17–27**, rows **1–4** (wide, short)
  - `O` — Мій кабінет (office): cols **17–27**, rows **6–9** (medium)
  - `V` — Ванна (bathroom): cols **17–27**, rows **11–13** (small)
- Open the five doors (char `+`, walkable): `(11,3)` studio↔hall, `(11,10)` kitchen↔hall, `(16,2)` bedroom↔hall, `(16,7)` office↔hall, `(16,12)` bathroom↔hall.
- Expose the letter→room-key map `LETTER = { A:"art", K:"kitchen", H:"hall", S:"sleep", O:"office", V:"bath" }`.

**Dependencies**
HVN-001 (grid constants and file).

**Expected result**
`computeWallMap` returns a 15×29 character grid with the six rooms carved, the hall spine, and the five doors opened; the hall connects every room.

**Acceptance criteria**
- [ ] All six rooms occupy exactly the coordinates above; sizes differ as specified.
- [ ] The five doors are at the exact cells listed and marked `+`.
- [ ] The hall spine (cols 12–15, rows 1–13) is open and adjacent to every room's door, so any room-to-room path passes through the hall.
- [ ] `LETTER` maps each room char to its key.

---

## HVN-003: Derived grids (`walkable`, `roomGrid`, `roomAt`)

**Description**
Derive the passability and room-lookup grids from the wall map via `useMemo`, including the door-cell room rule.

**What needs to be done**
- `walkable[y][x]` — boolean passability: `true` if the cell is not `#`.
- `roomGrid[y][x]` — room key per cell; for door cells (`+`), take the adjacent **non-hall** room (else `hall`).
- `wallMap` — keep the raw character grid (used later for wall-vs-floor rendering).
- `roomAt(x,y)` — returns `roomGrid[y][x]` (or `"hall"`).
- Compute all of these with `useMemo` keyed on the wall map.

**Dependencies**
HVN-002 (the wall map and `LETTER`).

**Expected result**
`walkable`, `roomGrid`, `wallMap`, and `roomAt` are available and correct, including doors resolving to their adjacent non-hall room.

**Acceptance criteria**
- [ ] `walkable` is `true` for room interiors, doors, and hall; `false` for walls.
- [ ] `roomGrid` assigns each interior cell its room key; door cells resolve to the adjacent non-hall room.
- [ ] `roomAt(x,y)` returns the correct key (or `"hall"`).
- [ ] Grids are memoized (not recomputed every render).

---

## HVN-004: Rooms, objects, decor & voice config

**Description**
Author the static content tables the simulation and renderer read from: room config, interactive drive-target objects, decorative props, the merged item map, and the fixed voice pools.

**What needs to be done**
- `ROOMS` — for each key `{ name, floor, color, verb, desc }`:
  | Key | name | floor | color | verb |
  |---|---|---|---|---|
  | hall | Хол | `#ece2cf` | `#6b7280` | йде |
  | office | Мій кабінет | `#cfe0f2` | `#3b6fb0` | поруч із тобою |
  | art | Майстерня Лілі | `#e6d6f2` | `#7a52b0` | малює |
  | sleep | Наша спальня | `#f0d9ec` | `#c0518f` | спить |
  | kitchen | Кухня | `#f1e7c0` | `#b0832a` | на кухні |
  | bath | Ванна кімната | `#cfe9e6` | `#2a8f93` | у ванні |
  Add a full atmospheric Ukrainian `desc` per room.
- `OBJECTS` — interactive drive targets `{x,y,glyph,room}`: 🎨 `(5,3)` art · 🛏️ `(22,2)` sleep · 🍲 `(5,11)` kitchen · 🛁 `(22,12)` bath · 💻 `(20,7)` office.
- `DECOR` — ~24 non-interactive props, a few per room, e.g. studio 🖼️🖌️🪴🪟; bedroom 🪟🌙🪴👗; office 📚☕🪑🪟; kitchen 🫖🪟🔪🪴🍞; bathroom 🚿🪞🧴🕯️; hall 🖼️🧥🪴.
- Merge both into `ITEM["x,y"] = glyph` for rendering.
- `VOICE` — fixed line pools per room (`art`, `sleep`, `kitchen`, `bath`, `office`) plus `you` (when the user is near) and `hall` (a `"…"` placeholder). Short, in-character, Ukrainian. (Model-generated only from v2.1 — fixed here.)

**Dependencies**
HVN-002 (room keys).

**Expected result**
`ROOMS`, `OBJECTS`, `DECOR`, `ITEM`, and `VOICE` exist with the exact coordinates/colors/verbs above and per-room descriptions and voice pools.

**Acceptance criteria**
- [ ] `ROOMS` has all six keys with the exact `floor`, `color`, and `verb` values and a non-empty Ukrainian `desc`.
- [ ] `OBJECTS` places the five interactive glyphs at the exact cells listed, each tagged with its room.
- [ ] `DECOR` adds several props per room; `ITEM["x,y"]` merges objects + decor.
- [ ] `VOICE` provides pools for `art`/`sleep`/`kitchen`/`bath`/`office` + `you`, and `hall = "…"`.

---

## HVN-005: Drives & target selection (`pickTarget`)

**Description**
Implement Лілі's drive state with its decay/refill tunables and the lowest-drive→room target mapping, including the warmth→office special case.

**What needs to be done**
- `drives = { натхнення, спокій, енергія, тепло }` (inspiration, calm, energy, warmth), each `0..100`; initial **78 / 60 / 52 / 46**.
- Tunables: decay per tick **−3** each (floor at 0); refill while acting **+17**/tick on the active drive; action ends when `actTicks >= 4` **or** the drive `>= 94`.
- `DRIVE_COLORS`: inspiration `#8a52c0`, calm `#2a9fb0`, energy `#d4609a`, warmth `#bf942a`.
- `pickTarget`: map the **lowest** drive to a room — `inspiration → art`, `energy → sleep`, `calm → bath`, `warmth → kitchen`. **Special case:** if the lowest is `warmth` **and** the user is currently in the office, the target becomes `office` (Лілі comes to you). The target is that room's `OBJECTS` entry.

**Dependencies**
HVN-003 (`roomAt` for the user's room), HVN-004 (`OBJECTS`).

**Expected result**
Drives initialize correctly, decay/refill per the tunables, and `pickTarget` returns the correct object for the lowest drive (with the warmth→office override).

**Acceptance criteria**
- [ ] Initial drives are 78/60/52/46; values clamp to `0..100`.
- [ ] Decay −3/tick, refill +17/tick; action ends at `actTicks≥4` or drive `≥94`.
- [ ] `pickTarget` maps inspiration→art, energy→sleep, calm→bath, warmth→kitchen.
- [ ] When warmth is lowest **and** the user is in the office, the target is the office object.
- [ ] `DRIVE_COLORS` matches the four hex values above.

---

## HVN-006: BFS navigation (`bfsNext`)

**Description**
Implement shortest-path stepping over the walkable grid: one cell toward a goal per call.

**What needs to be done**
- `bfsNext(start, goal)`: breadth-first search over `walkable`; build a `prev` grid, reconstruct the shortest path, and return the **next cell** (the first step from `start`).
- Unreachable goal → return `start` (no movement).
- Movement is **one cell per tick** (the tick calls `bfsNext` once).

**Dependencies**
HVN-003 (`walkable`).

**Expected result**
`bfsNext` returns the correct adjacent cell on the shortest path toward any reachable goal, and `start` when unreachable.

**Acceptance criteria**
- [ ] Returns the first step of a shortest path from `start` to `goal`.
- [ ] Returns `start` when the goal is unreachable or already reached.
- [ ] Steps exactly one cell (4-neighbour) per call; never enters a wall.
- [ ] Unit-tested against a few hand-checked start/goal pairs across rooms (path goes through the hall).

---

## HVN-007: Simulation tick & pause/step controls (`tick`)

**Description**
The heart of v0.1: the per-tick decision loop that advances the clock, decays drives, moves or acts Лілі, and updates her voice/log — driven by an interval with pause/step controls.

**What needs to be done**
Implement `tick` performing, in order:
1. Time `t += 9` min; at `t >= 1440` start a new day (`day += 1`, wrap `t`).
2. Decay all drives by 3 (floor 0).
3. Determine Лілі's room (`here = roomAt`) and whether the user is in the same room (`withYou`).
4. **If acting:** `actTicks++`, refill the target drive (+17); set `action = "<verb> (<room>)"`; if `withYou`, with prob. **0.5** change the label to "…, з тобою поруч" and with prob. **0.6** take a line from the `you` pool; end the action at the threshold (`actTicks≥4` or drive `≥94`).
5. **Else if a target exists:** if Лілі is on the target → begin acting (take a room voice line); else step via `bfsNext` and set `action = "йде до: <room>"`.
6. **Else:** pick a new target via `pickTarget`.
7. On a new non-`"…"` line → update `sim.voice` and append to the event log (keep the last 5, each with the time).
- Pace: `setInterval(tick, 850)` ms while `playing`. Provide **pause/play** and **step** (manual single `tick`) controls.

**Dependencies**
HVN-004 (`ROOMS` verbs, `VOICE`), HVN-005 (drives, `pickTarget`), HVN-006 (`bfsNext`).

**Expected result**
With play on, Лілі autonomously picks targets, walks one cell per tick toward them, acts on arrival (refilling the matching drive), and emits voice lines; pause halts and step advances exactly one tick.

**Acceptance criteria**
- [ ] Clock advances `+9` min/tick and rolls a new day at `1440`.
- [ ] The decide→move→act loop matches steps 1–7; drives decay and refill as specified.
- [ ] `withYou` triggers the "з тобою поруч" label (~0.5) and a `you` line (~0.6) when together.
- [ ] Reaching a target starts acting; the action ends at the threshold and a new target is chosen.
- [ ] `setInterval(tick, 850)` runs while `playing`; pause stops it; step performs one tick.
- [ ] The event log keeps the last 5 non-placeholder lines with timestamps.

---

## HVN-008: SVG scene rendering (tiles, props, sprites, bubble, day/night)

**Description**
Render the AI Town-style scene from the world and sim state: three tile/prop layers, character sprites with name tags, Лілі's speech bubble, and a day/night overlay.

**What needs to be done**
- **Tiles:** for each cell, a **wall** draws a base block `#c9a87a` (warm wood) with a lighter top band `#dcc295` (a ~4px faux-3D edge); a **floor** draws the room's pastel `ROOMS.floor` color with a faint grid stroke `#00000010`. Doors render as floor (openings).
- **Props:** items from `ITEM` drawn as centered emoji `<text>` on their tile (`fontSize ≈ TILE*0.72`).
- **Sprites (`Sprite` component):** a drawn top-down figure — soft drop-shadow ellipse; rounded-rect body (per-character color) with a faint outline; a hair circle; a skin head circle; two eye dots; for Лілі a pink hair streak; and a floating **name tag** (dark pill with the name). Лілі: body `#b3508f`, hair `#3a2530`, streak `#ff7fc4`, name "Лілі". Player: body `#3a6ea5`, hair `#26303a`, name "ти".
- **Speech bubble:** above Лілі, a `foreignObject` with a cream rounded bubble showing her current voice line (only when present and not `"…"`), positioned with her.
- **Day/night overlay:** a translucent `#2a3a6a` rect over the scene whose opacity tracks the hour — gentle evening only (max ~**0.24** at night, tapering at dusk/dawn, 0 by day).

**Dependencies**
HVN-003 (`wallMap`/`roomGrid`), HVN-004 (`ROOMS`, `ITEM`), HVN-007 (sim: positions, `voice`, clock).

**Expected result**
The full home renders: wood walls, pastel floors, emoji props, both character sprites with name tags, Лілі's speech bubble when she speaks, and an evening overlay that deepens at night.

**Acceptance criteria**
- [ ] Walls render with the base+top-band wood look; floors use each room's pastel color with the faint grid; doors render as floor.
- [ ] All `ITEM` glyphs render centered on their tiles.
- [ ] Both sprites render with the exact body/hair/streak colors and name tags ("Лілі", "ти").
- [ ] The speech bubble shows Лілі's current line and hides on `"…"`/empty.
- [ ] The day/night overlay uses `#2a3a6a` and peaks at ~0.24 opacity at night, 0 by day.

---

## HVN-009: Smooth sprite interpolation (no teleporting)

**Description**
Apply the "frontend in motion" principle inside the prototype: sprites glide between cells via CSS transitions rather than snapping.

**What needs to be done**
- Position each `Sprite` via `transform="translate(x*TILE, y*TILE)"` with a CSS `transition` on `transform`.
- Glide durations: **Лілі ~0.7 s** (≈ the 850 ms tick), **player ~0.18 s** (snappier).
- The speech bubble transitions together with Лілі so it tracks her smoothly.

**Dependencies**
HVN-008 (the `Sprite` and bubble rendering).

**Expected result**
Лілі and the player glide smoothly from cell to cell and never teleport; the bubble follows Лілі.

**Acceptance criteria**
- [ ] Sprites move via `transform` translate with a CSS transition (no instant jumps).
- [ ] Лілі's glide ≈ 0.7 s; the player's ≈ 0.18 s.
- [ ] The speech bubble moves smoothly with Лілі.
- [ ] Across a full walk between rooms there is no visible teleport (serves the phase DoD).

---

## HVN-010: Player presence & keyboard movement

**Description**
Add the user as a second character moved with the keyboard, constrained to walkable cells and disabled while typing.

**What needs to be done**
- Render the player as a second `Sprite` (body `#3a6ea5`, hair `#26303a`, name "ти") at a starting cell.
- Add a window `keydown` listener: arrows/WASD move the player one cell to an **adjacent walkable** cell (bounds check + `walkable` check; reject otherwise).
- **Guard:** if focus is in an `INPUT`/`TEXTAREA` (the chat field arriving in v0.2), ignore movement keys.
- Player movement feeds the sim so `withYou` / the warmth→office case (HVN-005/007) react to the user's room.

**Dependencies**
HVN-007 (sim state incl. user position used by the tick), HVN-008 (player sprite render).

**Expected result**
You walk your own character with arrows/WASD through walkable cells; walls/bounds block movement; typing in a field does not move you; Лілі reacts to your room.

**Acceptance criteria**
- [ ] Arrows and WASD each move the player one adjacent cell.
- [ ] Movement into a wall or out of bounds is rejected (no move).
- [ ] Movement keys are ignored while an `INPUT`/`TEXTAREA` is focused.
- [ ] The player's room drives `withYou` and the warmth→office special case.

---

## HVN-011: Surrounding UI (drive bars, action line, room cards, event log)

**Description**
Build the panel under the scene that makes the live simulation legible: drive bars, the current action, interior descriptions for both rooms, and the rolling event log.

**What needs to be done**
- **Drive bars:** for each of the four drives, 10 blocks (`█`/`░`) with fill `round(v/10)`, colored from `DRIVE_COLORS`.
- **Action line:** `▸ <action>` reflecting the sim's current action.
- **Room cards:** show the interior `desc` of Лілі's room and of the user's room; when both are in the same room, show a single **"Ви разом тут"** card instead.
- **Event log:** the last 5 voice lines with time, fading in opacity with age.
- **Controls:** the pause/step buttons (from HVN-007) plus a movement hint.

**Dependencies**
HVN-005 (`DRIVE_COLORS`, drive values), HVN-007 (sim: action, voice log, rooms).

**Expected result**
The panel shows live drive bars, the action line, the correct room card(s), and a fading 5-line event log; controls are present with a movement hint.

**Acceptance criteria**
- [ ] Four drive bars render 10 blocks each, filled by `round(v/10)` and colored per `DRIVE_COLORS`.
- [ ] The action line shows `▸ <action>` and updates each tick.
- [ ] Room cards show both rooms' descriptions, collapsing to "Ви разом тут" when together.
- [ ] The event log shows the last 5 lines with time and an age-based opacity fade.
- [ ] Pause/step controls and a movement hint are present.

---

## Notes for `/upload-issues`

- Run `/upload-issues @specification/roadmap/implementation/v0-issues.md` to push these to GitHub.
- Label prefix: `v0::`. Area label used: `v0::area:frontend`. Sizes: S/M/L per the table.
- After upload, a `v0-github-report.md` records the HVN→GitHub# mapping; `/execute-issues v0::version:0` then implements them in dependency order.
