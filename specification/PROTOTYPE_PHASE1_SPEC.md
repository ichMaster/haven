# PROTOTYPE_PHASE1_SPEC.md — v0.1 graphical home + autonomous Лілі

Parameter-level specification of the v0 Phase 1 (`v0.1`) prototype `lili_house_aitown.jsx`: the AI Town-style graphical scene, the world, the single-agent simulation (Лілі), player presence, and the smooth rendering. This is the visual and simulation seed the FastAPI backend owns from v1 (see ARCHITECTURE §How it grows, ROADMAP §v0.1). The in-character chat is `v0.2` and is **out of scope here**. In-app strings (room names, voice) are **Ukrainian** by design, since Лілі speaks Ukrainian. All concrete values are stated explicitly as parameters to edit (§17).

---

## 1. Goals and non-goals

**Goal.** Prove the *feel* of the home end to end in a single file: a top-down graphical home where Лілі lives autonomously by her drives, navigates room to room, and glides smoothly while you walk your own character through the same space — with no backend.

**Non-goals (here).** No chat (that is `v0.2`); no backend, REST, or persistence (that is v1); no multiple agents (v1.3); no model-generated voice (the pools are fixed, v2.1); not pixel-art tilesets (drawn shapes + emoji). The single-cell-tick + frontend-interpolation split modeled here is the same one the backend will own from v1 (ARCHITECTURE §Movement and smoothness).

## 2. Technical basis

- A single React file (default component `LiliHouseAITown`), self-contained, **no backend** in this phase.
- Grid constants: `W = 29` (columns), `H = 15` (rows), `TILE = 24` (pixels per cell).
- Scene size: `SW = W*TILE = 696`, `SH = H*TILE = 360`; rendered as an SVG with `viewBox="0 0 696 360"`, `width:100%` so it scales to the container.
- Simulation state in `useState` (`sim`); an async mirror `simRef` for use inside async/interval callbacks.
- Light AI Town palette: page `#f3efe6` (warm cream), scene surround `#bcd9b0` (soft grass, visible above the house where the speech bubble floats).

## 3. World — floor plan (`computeWallMap`)

The plan is built procedurally into an `H×W` array of characters, filled with walls `#`, into which room rectangles are carved with `rect(x0,y0,x1,y1,ch)` and doors opened.

Rooms (character → interior coordinates, inclusive):

| Char | Room | Cols x | Rows y | Size |
|---|---|---|---|---|
| A | Майстерня Лілі (studio) | 1–10 | 1–6 | large |
| K | Кухня (kitchen) | 1–10 | 8–13 | large |
| H | Хол (hall, hub-spine) | 12–15 | 1–13 | vertical corridor |
| S | Наша спальня (bedroom) | 17–27 | 1–4 | wide, short |
| O | Мій кабінет (office) | 17–27 | 6–9 | medium |
| V | Ванна (bathroom) | 17–27 | 11–13 | small |

Doors (character `+`, walkable): `(11,3)` studio↔hall, `(11,10)` kitchen↔hall, `(16,2)` bedroom↔hall, `(16,7)` office↔hall, `(16,12)` bathroom↔hall. The hall spine (cols 12–15, rows 1–13) connects all rooms, so any path between rooms passes through the hall (this guarantees BFS connectivity, ARCHITECTURE §The world).

Letter → room-key map: `LETTER = { A:"art", K:"kitchen", H:"hall", S:"sleep", O:"office", V:"bath" }`.

## 4. Derived grids (`useMemo`)

From the plan:
- `walkable[y][x]` — boolean passability (`true` if the cell is not `#`).
- `roomGrid[y][x]` — room key per cell; for door cells `+`, taken from the adjacent non-hall room (else hall).
- `wallMap` — the raw character grid (used for rendering walls vs floors).
- `roomAt(x,y)` returns `roomGrid[y][x]` (or `"hall"`).

## 5. Room config (`ROOMS`)

Each room: `{ name, floor, color, verb, desc }`.

| Key | name | floor | color (accent) | verb |
|---|---|---|---|---|
| hall | Хол | #ece2cf | #6b7280 | йде |
| office | Мій кабінет | #cfe0f2 | #3b6fb0 | поруч із тобою |
| art | Майстерня Лілі | #e6d6f2 | #7a52b0 | малює |
| sleep | Наша спальня | #f0d9ec | #c0518f | спить |
| kitchen | Кухня | #f1e7c0 | #b0832a | на кухні |
| bath | Ванна кімната | #cfe9e6 | #2a8f93 | у ванні |

`floor` is the pastel tile color of the room; `color` is the accent used in room cards; `verb` is the action word; `desc` is a full atmospheric interior description (edited in `ROOMS`). These map to the ARCHITECTURE §Data model **Room** shape.

## 6. Objects and decor

**Interactive objects** `OBJECTS` (drive targets) `{x,y,glyph,room}`:
- 🎨 `(5,3)` art · 🛏️ `(22,2)` sleep · 🍲 `(5,11)` kitchen · 🛁 `(22,12)` bath · 💻 `(20,7)` office.

**Decor** `DECOR` (~24 non-interactive props), a few per room, e.g. studio 🖼️🖌️🪴🪟; bedroom 🪟🌙🪴👗; office 📚☕🪑🪟; kitchen 🫖🪟🔪🪴🍞; bathroom 🚿🪞🧴🕯️; hall 🖼️🧥🪴.

Both lists are merged into `ITEM["x,y"] = glyph` for rendering; props are drawn as emoji on the tiles.

## 7. Drives (single agent: Лілі)

State `drives = { натхнення, спокій, енергія, тепло }` (inspiration, calm, energy, warmth), each `0..100`. Initial: `78 / 60 / 52 / 46`.

Parameters (tunable):
- decay per tick: `−3` each;
- refill while acting: `+17` per tick on the active drive;
- action ends when `actTicks >= 4` or the drive `>= 94`.

Bar colors `DRIVE_COLORS`: inspiration `#8a52c0`, calm `#2a9fb0`, energy `#d4609a`, warmth `#bf942a`.

## 8. Target selection (`pickTarget`)

The lowest drive is mapped to a room: `inspiration → art`, `energy → sleep`, `calm → bath`, `warmth → kitchen`. **Special case:** if the lowest is `warmth` **and** the user is currently in the office, the target becomes `office` (Лілі comes to you). The target is the `OBJECTS` entry of that room. (This is the mapping ARCHITECTURE §Agents generalizes per-agent in v1.3.)

## 9. Navigation (`bfsNext`)

Breadth-first search over `walkable`; returns the **next cell** on the shortest path from start to goal (builds a `prev` grid, reconstructs, takes the first step). Unreachable → returns start. Movement is **one cell per tick**.

## 10. Simulation tick (`tick`)

1. Time `t += 9` min; at `t >= 1440` a new day (`day += 1`).
2. Decay all drives by 3 (floor 0).
3. Determine Лілі's room (`here`) and whether the user is in the same one (`withYou`).
4. **If acting:** `actTicks++`, refill the target drive, set `action = "<verb> (<room>)"`; if `withYou`, with prob. 0.5 change the label to "…, з тобою поруч" and with 0.6 take a line from the `you` pool; end the action at the threshold.
5. **Else if a target exists:** if Лілі is on the target → begin acting (take a room voice line); else step via `bfsNext` and set `action = "йде до: <room>"`.
6. **Else:** pick a new target with `pickTarget`.
7. New non-"…" line → update `sim.voice` and append to the log (last 5 with time).

Pace: `setInterval(tick, 850)` ms while `playing`. Buttons **pause/play** and **step** (manual `tick`).

## 11. Voice (`VOICE`)

Fixed line pools per room (art, sleep, kitchen, bath, office) plus `you` (when you are near) and `hall` (a `"…"` placeholder). In this phase these are fixed sets — **model-generated from v2.1** (ROADMAP §v2.1).

## 12. Player presence and movement

The user is a second character. A window `keydown` listener moves it with arrows/WASD to an adjacent walkable cell (bounds + `walkable` checks). **Guard:** if focus is in an `INPUT`/`TEXTAREA` (the chat field arriving in `v0.2`), movement is ignored.

## 13. Graphical rendering (AI Town style, SVG)

The scene is an SVG with three layers plus characters and overlays.

- **Tiles.** For each cell: a **wall** draws a base block `#c9a87a` (warm wood) with a lighter top band `#dcc295` (a 4px faux-3D edge); a **floor** draws the room's pastel `floor` color with a faint grid stroke `#00000010`. Doors render as floor (openings).
- **Props.** Items from `ITEM` drawn as emoji `<text>` centered on their tile (`fontSize ≈ TILE*0.72`).
- **Character sprites (`Sprite`).** A drawn top-down figure: a soft drop-shadow ellipse; a rounded-rect body (color per character) with a faint outline for contrast on light floors; a hair circle; a skin head circle; two tiny eye dots; for Лілі a pink hair streak; and a floating **name tag** (a dark pill with the name). Лілі: body `#b3508f`, hair `#3a2530`, streak `#ff7fc4`, name "Лілі". Player: body `#3a6ea5`, hair `#26303a`, name "ти".
- **Speech bubble.** Above Лілі, a `foreignObject` with a cream rounded bubble showing her current voice line (when present and not "…"), moving with her.
- **Day/night overlay.** A translucent `#2a3a6a` rect over the scene whose opacity depends on the hour — gentle evening only (max ~0.24 at night, tapering at dusk/dawn, 0 by day).

## 14. Smoothness — frontend responsibility

The backend (from v1) works in discrete cells; in this phase the **same principle holds inside the prototype**: each `Sprite` is positioned via `transform="translate(x*TILE, y*TILE)"` with a CSS `transition` on `transform`, so characters **glide between cells and never teleport**. Лілі glides over `0.7s` (≈ the tick), the player over `0.18s` (snappier). The speech bubble transitions with her. This is the "frontend in motion" half of the split in ARCHITECTURE §Movement and smoothness.

## 15. Surrounding UI

Below the scene: **drive bars** (10 blocks `█`/`░`, fill `round(v/10)`, colored from `DRIVE_COLORS`); the **action line** (`▸ <action>`); **room cards** showing the interior description of Лілі's room and the user's room (a single "Ви разом тут" card when together); an **event log** (last 5 voice lines with time, fading in opacity); and **controls** (pause/step, movement hint). (The chat panel belongs to `v0.2`.)

## 16. Definition of done

Лілі autonomously glides room to room driven by her drives; you move your own character smoothly with arrows/WASD; interior descriptions update for both her room and yours; sprites glide and never teleport; pause/step controls work; the event log and drive bars reflect the live simulation. (Matches ROADMAP §v0.1 DoD.)

## 17. Parameters for quick edits (summary)

- **Grid/scene:** `W`, `H`, `TILE`, palette (`#f3efe6`, `#bcd9b0`, wall `#c9a87a`/`#dcc295`, room `floor` colors).
- **Plan:** rectangles in `computeWallMap`, door coordinates.
- **Rooms:** `ROOMS` (names, `floor`, accent `color`, `verb`, `desc`).
- **Items:** `OBJECTS` (interactive) and `DECOR` (props).
- **Drives:** initial values, decay (−3), refill (+17), thresholds (4 / 94), `DRIVE_COLORS`.
- **Behavior:** drive→room mapping in `pickTarget` (incl. office case), pace `setInterval(…, 850)`.
- **Voice:** `VOICE` pools.
- **Sprites/smoothness:** body/hair colors, glide durations (0.7 / 0.18), day/night opacity curve.

## 18. Maps to the architecture and roadmap

- This prototype is **`v0.1`** (ROADMAP): the graphical home and one autonomous agent, rendered with smooth interpolation.
- It is the visual and simulation seed the **FastAPI backend owns from v1.1**, and that generalizes to multiple agents in **v1.3**.
- `computeWallMap`/derived grids → ARCHITECTURE §The world; drives/`pickTarget`/`bfsNext`/`tick` → §Agents and §Simulation tick; the `transform`-transition glide → §Movement and smoothness; `ROOMS`/`OBJECTS` → §Data model (Room, Object).

## 19. Open decisions (to confirm before the v1 port)

- Whether the v1 backend keeps the prototype's exact tunables (decay −3, refill +17, thresholds 4/94, 850 ms tick) or re-tunes for a ~1 s server tick.
- Whether per-agent drive→room mappings (v1.3) reuse Лілі's room set or vary per character.
- Whether the day/night curve and clock pacing (`+9` min/tick) carry over unchanged to the server clock.
