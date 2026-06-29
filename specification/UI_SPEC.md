# UI_SPEC.md — Haven v0 prototype UI

Detailed specification of the **user interface** of the v0 prototype as currently
implemented in the single self-contained file [lili_house_aitown.jsx](../lili_house_aitown.jsx)
(default export `LiliHouseAITown`). This documents the *rendered* UI — layout,
panels, components, parameters, data attributes, and behaviours — and complements
[PROTOTYPE_PHASE1_SPEC.md](PROTOTYPE_PHASE1_SPEC.md) (the v0.1 simulation/world spec)
and [ARCHITECTURE.md](ARCHITECTURE.md).

In-app text is **Ukrainian** by design. All values below are the ones pinned in
code; treat them as the editable parameters of the UI.

> Status note: this is a graphical prototype with the simulation in the browser.
> Some elements are **static previews** of later phases (town residents, café
> agent thoughts) and are called out as such. The Anthropic key is a gitignored
> frontend env var in v0.2 only (moves server-side at v1.5).

---

## 1. Overall layout

The page is a warm-cream surface that centres a responsive **two-column** area
with a **full-width town map** beneath it.

```
┌─ page (bg #f3efe6, padding 16) ───────────────────────────────────────────┐
│  ┌─ wrapper (max-width 1080, centred) ─────────────────────────────────┐  │
│  │  ┌─ row (flex, gap 16, wrap, align-items: flex-start) ───────────┐  │  │
│  │  │  ┌ LEFT col (flex 1 1 520) ┐   ┌ RIGHT col (flex 1 1 300) ──┐  │  │  │
│  │  │  │ • location header        │   │ • thought cards (agents)  │  │  │  │
│  │  │  │ • SCENE (SVG)            │   │ • chat panel              │  │  │  │
│  │  │  │ • clock (● наживо)       │   │                           │  │  │  │
│  │  │  │ • action line (home)     │   │                           │  │  │  │
│  │  │  │ • drives (per agent)     │   │                           │  │  │  │
│  │  │  │ • movement hint          │   │                           │  │  │  │
│  │  │  └──────────────────────────┘   └───────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │  TOWN MAP (full width, 8×4 grid)                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Page**: background `#f3efe6` (`PALETTE.page`), `padding: 16`, font `system-ui`.
- **Wrapper**: `max-width: 1080px`, centred.
- **Row**: `display:flex; gap:16; flex-wrap:wrap; align-items:flex-start` — on
  narrow viewports the right column wraps below the left.
- **Left column**: `flex: 1 1 520px` — the world + simulation panels.
- **Right column**: `flex: 1 1 300px; min-width: 260px` — agent thoughts + chat.
- **Town map**: full width, below the row.

The page reflects the **active location** (`activeLocation`: `"house"` or
`"cafe"`). The scene, location header, action line, drives and thought cards all
key off the active location.

---

## 2. Location header

Above the scene (`[data-location]`): a single line naming the current town-map
location, sourced from `LOCATION_META[activeLocation]`.

- `{emoji} **{name}** · локація на карті · ви тут` (font 15, `#3a3530`).
- When `activeLocation !== "house"`, a right-aligned **`← Дім Лілі`** button
  (font 12) returns home (`travel("house")`).

---

## 3. The scene (top-down SVG)

A single SVG, `viewBox="0 0 696 360"`, `width:100%`, background `#bcd9b0`
(`PALETTE.surround`), `border-radius: 8`. Two scene components share one look:

| | `Scene` (house) | `LocationScene` (visit loc) |
|---|---|---|
| When | `activeLocation === "house"` | else |
| Floors | per-room pastel `ROOMS[room].floor` | single `world.floor` |
| Props | `ITEM` (objects + decor) | `world.items` |
| Characters | Лілі (drive-driven) + player + speech bubble | location agents (wander) + player |

Layers, bottom to top: **tiles** (`[data-layer="tiles"]`) → **props**
(`[data-layer="props"]`) → **day/night overlay** (`[data-layer="daynight"]`) →
**sprites** → **speech bubble** (house only, `[data-layer="bubble"]`).

**Tiles.** `TILE = 24` px. A **wall** is a base block `#c9a87a` (`WALL_BASE`,
warm wood) with a 4px lighter top band `#dcc295` (`WALL_TOP`). A **floor** is the
room/location colour with a faint grid stroke `#00000010`. Doors render as floor.

**Props.** Emoji drawn as centred `<text>`, `font-size ≈ TILE*0.72`.

**Day/night overlay.** A translucent `#2a3a6a` (`NIGHT_TINT`) rect whose opacity
is `dayNightOpacity(t)`: `0` by day, ramping through dusk (18→21h) and dawn
(5→7h), peaking at `NIGHT_MAX = 0.24` deep at night.

### 3.1 Sprite (`Sprite`)

A drawn top-down figure positioned via `transform="translate(x*TILE, y*TILE)"`
with a CSS `transition: transform {dur}s linear` (the "frontend in motion"
glide; `dur=0` snaps). Parts: soft drop-shadow ellipse, rounded-rect body
(per-character colour) with a faint outline, hair circle, skin head circle, two
eye dots, an optional hair streak, and a floating **name-tag pill**
(`#2a2620cc`, light text) carrying `data-sprite="{name}"`.

| Character | body | hair | streak | name | glide |
|---|---|---|---|---|---|
| Лілі | `#b3508f` | `#3a2530` | `#ff7fc4` | `Лілі` | `0.7s` (`GLIDE_LILI`) |
| Player | `#3a6ea5` | `#26303a` | — | `ти` | `0.18s` (`GLIDE_YOU`) |
| Location agent | agent colour | `#3a2f2a` | — | agent name | `0.6s` |

**Speech bubble** (house): a cream `foreignObject` above Лілі showing her current
voice line, only when present and not `"…"`; it shares her transform + glide.

---

## 4. Clock — continuous life

The world **always runs** — there are no pause / step / play controls (the
characters live whether or not you interact). Under the scene:

- a green dot `●` (`#3a9b5c`) + `наживо`,
- right-aligned `День {day} · {HH:MM}` (`fmtTime`, tabular numerals).

The world tick is `setInterval(tick, TICK_MS)` with `TICK_MS = 850` ms, running
for the whole session.

---

## 5. Action line (home only)

`[data-action]`, shown only when `activeLocation === "house"`:
`▸ Лілі {action}` (e.g. `▸ Лілі йде до: Кухня`, `▸ Лілі малює (Майстерня Лілі)`).
It names the actor (Лілі) and reflects her current activity each tick. Hidden in
visit locations.

---

## 6. Drives panel (per agent)

`[data-panel="drives"]` — `display:flex; gap:20; flex-wrap:wrap`. Renders one
`AgentDrives` block **per agent currently in the active location** (the player is
not an autonomous agent and has no drives):

- **House** → Лілі (drives = live `sim.drives`).
- **Café** → Марко and Зоя (static per-agent drive values).

Each `AgentDrives` block (`[data-agent-drives="{name}"]`, `min-width: 170`):
- header: a colour dot (agent colour) + **name**;
- a 2-column grid of the four drives, each row = drive label + a 10-cell bar
  `[data-bar="{key}"]`.

**Drives.** `натхнення / спокій / енергія / тепло` (inspiration / calm / energy /
warmth), `0..100`. Bar = `barString(v)`: `round(v/10)` filled `█` + rest `░`
(10 chars), monospace, coloured by `DRIVE_COLORS`:

| drive | colour |
|---|---|
| натхнення | `#8a52c0` |
| спокій | `#2a9fb0` |
| енергія | `#d4609a` |
| тепло | `#bf942a` |

Лілі's drives are simulated (init `78/60/52/46`, decay `−3`/tick, refill `+17`
while acting); café agents' drives are a **static preview**.

---

## 7. Movement hint

`Рухайтесь: ← ↑ → ↓ або WASD · напишіть Лілі праворуч` (font 12, muted). Arrows
and WASD move the player one walkable cell in the active location; movement keys
are ignored while a text field (the chat input) is focused.

---

## 8. Thought cards (right column, per agent)

`[data-card="{agentId}"]` — one card per agent in the active location, showing
that agent's **thought / observation** (not a room description):

- header: colour dot + **{name} · {place}** (place = Лілі's current room at home,
  or the location name in a visit scene);
- body: `💭 {thought}` in italics, clamped to **4 lines** (`cardDescStyle`).

Card style (`cardStyle(accent)`): left border `4px` in the agent's colour,
background `#fffdf8`, radius 8, padding `6px 9px`.

- **House** → Лілі's card; her thought is **live** (her current voice line, e.g.
  "Колір лягає сам собою."; falls back to a calm default when silent).
- **Café** → Марко's and Зоя's cards (static thought lines, a preview).

The player has no thought card.

---

## 9. Chat panel

`[data-panel="chat"]` (right column): border `#e3dcc9`, radius 10, background
`#fffdf8`. You talk to **Лілі** here regardless of which location you're viewing.

- **Transcript** (`[data-chat="transcript"]`): `min-height 280`, `max-height 640`,
  scrolls. Messages are bubbles: user → right-aligned `#dceaf6`; Лілі →
  left-aligned `#f0e6f4`. Empty state shows a hint. A `[data-chat="typing"]`
  indicator ("Лілі друкує…") shows while a reply is pending. If
  `VITE_ANTHROPIC_API_KEY` is absent, a one-time `[data-chat="offline-note"]`
  explains the chat is offline.
- **Input form**: a single-line `[data-chat-input]` ("Напишіть Лілі…") + a
  **Надіслати** button. Both disable while a reply is in flight; send is also
  disabled on empty input. Enter submits.

**Behaviour.** On submit: append the user turn, call `askLili` with the **live
context** from `simRef.current` (Лілі's room/action, your room, together-or-not),
append her reply, clear the input. Replies are short, Ukrainian, in-character,
no lists/emoji. Failures and a missing key resolve to a short in-character
fallback (never a raw error). Model: `CHAT_MODEL = "claude-opus-4-8"`.

---

## 10. Town map (full width)

`[data-town]` — a preview of the wider town below both columns.

- Heading **`Карта міста`** + subtitle: "Натисніть доступну локацію, щоб перейти.
  Зараз відкриті: Дім Лілі та Кафе."
- Grid: `grid-template-columns: repeat(8, 1fr)`, gap 6, on a grey
  background `#c2c6cb` — the **grey gaps read as streets**. **8×4 = 32 cells.**

### 10.1 Cell

Each cell (`[data-town-cell="{kind}"]`, `min-height 62`) shows an emoji, a label,
optional resident chips, and a status badge:

- `[data-available]` — `"true"` for travelable cells, else `"false"`.
- `[data-loc]` — the location id for travelable cells (`house`, `cafe`).
- `[data-active]` — `"true"` on the cell of the active location.
- **Badge** (top-right): `📍` active · `🚪` travelable (not active) · `🔒` locked.
- **Background**: available `#e7d8f5`; otherwise `TOWN_BG[kind]`
  (house `#efe6f7`, shop `#f6ead2`, civic `#dce7f5`, nature `#d2e8c6`,
  water `#cfe2ee`, mountain `#e6ded3`).
- **Border**: active `2px #7a52b0` (+ glow) · travelable `2px #b48fd0` ·
  locked `1px #00000012`.
- **Travelable cells** are clickable (`role="button"`, `cursor:pointer`,
  Enter/Space) → `onTravel(loc)`.

### 10.2 Residents on the map

A cell may show **resident chips** (`[data-residents]`): one chip per inhabitant
(`[data-resident="{id}"]`) — a white pill with a colour dot (the agent's colour)
+ name. This is a **static preview** of a populated town (`TOWN_RESIDENTS`):

| cell | residents |
|---|---|
| Дім Лілі | Лілі, ти |
| Парк | Ніна, Богдан |
| Школа | Іван, Соломія |
| Кафе | Марко, Зоя |
| Супермаркет | Сергій, Катря |
| Площа | Юрій, Мирослава, Остап |
| Сусіди · Гори · Книгарня · Галерея · Лікарня · Стадіон · Маяк | one each |

The 32 cells are named real locations (residential / shops / civic / nature /
water / mountain) — see `TOWN`. Only **Дім Лілі** and **Кафе** are travelable now.

---

## 11. Locations & navigation

Two locations are visitable; you travel by clicking a travelable cell on the town
map, or via the `← Дім Лілі` header button.

| | Дім Лілі (`house`) | Кафе (`cafe`) |
|---|---|---|
| Map | rich multi-room floor plan (`computeWallMap`) | open-room map (`makeLocationWorld`), floor `#f1e7c0`, café props |
| Simulation | full drive loop (Лілі) + player + chat | agents (Марко, Зоя) **wander**; player walks |
| Agents shown | Лілі | Марко, Зоя |
| Drives / thoughts | Лілі (live) | Марко, Зоя (static preview) |

- **Travel** (`travel(locId)`): switches `activeLocation`; for a visit location it
  seeds `visit` (player at `playerStart`, agents at their start cells).
- The **house keeps living** in the background (its tick never stops); Лілі does
  **not** follow you to the café.
- Café agents wander on their own interval (`wanderStep`, every `TICK_MS`) while
  you're there: each picks a random walkable cell and BFS-steps toward it.
- The player has an independent position per location; arrows/WASD move the
  player within the active location's walkable grid.

Future locations (Парк, Супермаркет, Площа, …) exist on the map as named,
populated, but **locked** previews (ROADMAP v3.1).

---

## 12. Palette & parameter summary

| Group | Values |
|---|---|
| Page / surround | `#f3efe6` / `#bcd9b0` |
| Walls | base `#c9a87a`, top `#dcc295` |
| Night tint / max | `#2a3a6a` / `0.24` |
| Drive colours | `#8a52c0 / #2a9fb0 / #d4609a / #bf942a` |
| Лілі / player sprite | body `#b3508f` / `#3a6ea5` |
| Glide durations | Лілі `0.7s`, player `0.18s`, NPC `0.6s` |
| Grid / tile | `29×15`, `TILE=24` (scene `696×360`) |
| Tick pace | `850 ms` (continuous) |
| Layout | wrapper `1080`, left `1 1 520`, right `1 1 300`, gap `16` |
| Town map | `8×4`, gap `6`, street bg `#c2c6cb`, cell `min-height 62` |
| Chat transcript | `min-height 280`, `max-height 640` |
| Chat model | `claude-opus-4-8` |

---

## 13. Data attributes (for tests / inspection)

| Attribute | Meaning |
|---|---|
| `[data-location]` | location header (active location) |
| `[data-action]` | action line (home only) |
| `[data-panel="drives"]` | drives container |
| `[data-agent-drives="{name}"]` | one agent's drive block |
| `[data-bar="{drive}"]` | a single 10-cell drive bar |
| `[data-card="{agentId}"]` | an agent thought card |
| `[data-panel="chat"]`, `[data-chat="transcript"\|"typing"\|"offline-note"]`, `[data-chat-input]` | chat UI |
| `[data-sprite="{name}"]` | a character sprite group |
| `[data-layer="tiles"\|"props"\|"daynight"\|"bubble"]` | scene layers |
| `[data-town]`, `[data-town-cell="{kind}"]`, `[data-available]`, `[data-loc]`, `[data-active]`, `[data-residents]`, `[data-resident="{id}"]` | town map |

---

## 14. Accessibility & responsiveness

- The SVG scene carries `role="img"` + an `aria-label`; the chat input has an
  `aria-label`; travelable town cells are `role="button"` + keyboard-activatable.
- The layout wraps to a single column on narrow viewports; the SVG scales to its
  column width (`width:100%` + viewBox).
- Movement keys are suppressed while a text field is focused, so typing in chat
  never moves the player.

---

## 15. Relation to the roadmap

This UI realises **v0** (graphical prototype): v0.1 (autonomous Лілі + home) and
v0.2 (in-character chat), plus a forward-looking town-map/navigation preview that
seeds **v3.1** (larger map and locations) and a multi-agent presentation that
seeds **v1.3**. The town residents and café agent thoughts/drives are static
previews until the backend owns multiple agents (v1.3+) and multiple locations
(v3.1).
