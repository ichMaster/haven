# Architecture — Haven ("Haven")

## Overview

A graphical, top-down web world over a server-owned simulation. The architecture evolves across versions: in **v0** the whole world — render, simulation, and the model calls for chat — lives in a single self-contained React file in the browser (no backend); from **v1** the **backend (Python)** owns the world, the simulation, and all language-model calls, reached first over a **telnet command server** (a text front-end); from **v2** a **FastAPI REST API** exposes the same world and the **frontend** becomes a thin graphical client that renders the scene, lets the user move, interpolates motion smoothly, and sends actions. The world advances in discrete **ticks** on the backend; the web frontend obtains state by **REST polling** (no WebSocket — chosen for simplicity and firewall friendliness). The guiding split is **"backend in cells, frontend in motion"**: the backend reasons only in integer grid cells, the frontend does all pixel-level smoothing.

## System diagram

```
            v0 single-file path: React artifact → cloud AI (Anthropic) over HTTPS
            (browser owns world + sim + chat; no backend of ours)
      +---------------------------------------------------------------+
      |                                                               v
+-----+-------------------+                          +----------------------------+
|   Frontend (React)      |                          |        External AI         |
|  thin client, v2+       |                          |     Anthropic (Claude)     |
|  - render top-down SVG  |                          |  main model · cheap model  |
|  - player input (keys)  |                          +----------------------------+
|  - visual interpolation |                                        ^
+-----+-------------------+                                        | HTTPS REST
      |  GET /world (once)                                         | (server -> AI, v1+)
      |  GET /state (poll ~1-2s)        +----------------------------+-------------+
      |  POST /move {dir}      <------> |        Backend (Python, v1+ · REST v2+)  |
      |  POST /chat {agent,text} (v2)   |  world build · walkable grid · rooms     |
      +-------------------------------> |  agents: drives · decision loop · BFS    |
   telnet client ───────────────────▶  |  tick loop (world clock)                 |
   (text front-end, v1+)               |  telnet command server (v1+)             |
                                        |  LLM calls (chat, ambient, inter-agent)  |
                                        |  holds the API key                       |
                                        +------------------+-----------------------+
                                                           | (v3+)
                                                           v
                                        +----------------------------+
                                        |  Persistence (v3)          |
                                        |  world state · per-agent   |
                                        |  memory of encounters      |
                                        +----------------------------+
```

The tiers grow by version: in **v0** the browser is the whole system (render + simulation + chat to Anthropic directly); from **v1** a headless Python backend runs the tick loop, holds the key, and is reached over a **telnet command server** (no browser); from **v2** a REST API exposes the same world and the web frontend speaks REST to it; from **v3** the backend persists world state and per-agent memory. The web frontend stays thin in every version after v0 — render, input, and interpolation, no world logic.

## Components

- **Terminal server (telnet, from v1).** A TCP server speaking a line-based command protocol — the human-facing front-end before the web client. A session controls the player (`ти`) and observes/moves/talks to inhabitants in text; the world pushes live event narration. See TERMINAL_SERVER_SPEC.md.
- **Frontend (graphical web client, React; from v2).** Renders the top-down scene (drawn floors/walls, item props, character sprites, name tags, speech bubbles, day/night) in the AI Town style; handles player movement input (keyboard now, mouse later); **interpolates** each agent's motion between the cells the backend reports so sprites glide; shows drive bars, thoughts, and chat. From v2 it fetches `/world` once, polls `/state` each tick, and posts `/move` and `/chat`. In v0 it *is* the whole app (see PROTOTYPE_PHASE1_SPEC.md / UI_SPEC.md).
- **Backend (Python; from v1, REST/FastAPI from v2).** Owns the world (floor plan, walkable grid, rooms, items), the set of **agents** (each with canon, drives, position, action, voice), the simulation loop (decay → decision → BFS navigation → inter-agent resolution → world clock), and the language-model calls (Anthropic, Claude) for chat replies and ambient / inter-agent lines. Reached over a **telnet command server** (from v1) and a **REST API** (from v2). **Holds the API key — it is never in the frontend.**
- **Simulation engine (backend, from v1).** A fixed-interval tick loop advancing every agent by at most one cell; works purely in **discrete grid cells**, never pixels (ARCHITECTURE §Movement and smoothness).
- **Voice (model; v0 frontend, v1+ backend).** Assembles each system prompt from an agent's canon plus live world context and calls Claude for an in-character reply; a cheaper model is used for ambient and inter-agent lines (from v3.1 these are model-generated, ARCHITECTURE §Voice).
- **Persistence (backend, from v3).** Stores world state and per-agent memory of encounters so characters recall earlier moments and the world resumes after a restart.

## The world (floor plan)

- A floor-plan template defines the rooms; a build step carves room rectangles and the central hall, then opens doors. In the prototype this is `computeWallMap` (PROTOTYPE_PHASE1_SPEC.md §2).
- **Rooms (current home):** **hall** (central hub/spine), **office** (the user's room), **studio** (Лілі's, large), **bedroom** (shared), **kitchen**, **bathroom** (small). Sizes differ deliberately. Ukrainian names: Хол, Мій кабінет, Майстерня Лілі, Наша спальня, Кухня, Ванна кімната.
- Each room has a floor color, an interior description, decorative items, and (except the hall) **one interactive object** tied to a drive.
- **Walkable cells** = room interiors + doors + hall; the hall spine connects every room, so any path between two rooms passes through the hall — this guarantees connectivity for BFS. The world lives on the backend (from v1); the web frontend (from v2) receives a static description once (`GET /world`) and dynamic agent positions each tick (`GET /state`).

## Agents (multi-character)

- An **agent** is `{ id, name, canon, drives, x, y, target, action, voice }`. Лілі is one of several (multiple agents land in v2.3).
- **Drives:** `inspiration`, `calm`, `energy`, `warmth` — each `0..100`, decaying every tick.
- **Decision loop, per agent per tick:**
  1. **Decay** every drive (floor at 0).
  2. **If acting:** refill the active drive each tick; end the action when it is satisfied (a tick threshold or the drive crossing a high-water mark — prototype values in PROTOTYPE_PHASE1_SPEC.md §6).
  3. **Else if a target is set:** step **one cell** toward it via **BFS** over the walkable grid.
  4. **Else pick a new target:** the interactive object of the agent's **lowest** drive, via that agent's drive→room mapping. Лілі's mapping: `inspiration→studio`, `energy→bedroom`, `calm→bathroom`, `warmth→kitchen` — **except** when the lowest drive is `warmth` *and* the user is currently in the office, the target becomes the office (Лілі comes to you).
- **Basic inter-agent interaction (from v2.4):** when two agents share a room, with some probability they exchange a short in-character line (a cheap-model LLM call); each remembers the encounter lightly and their actions/voices reflect each other's presence.
- **Ambient voice:** when an agent begins an action it emits a short in-character line — a fixed pool in the prototype (PROTOTYPE_PHASE1_SPEC.md §10), model-generated from v3.1.

## Simulation tick

- The backend advances the world on a fixed interval (~1 s; the prototype uses 850 ms). Each tick: advance the world **clock**; for every agent run the decision loop (one cell of movement max); resolve inter-agent encounters; update voices/actions.
- The backend works in **discrete grid cells** — it never computes pixel animation. The clock rolls minutes per tick and a day boundary increments the day counter (prototype: `+9` min/tick, new day at `1440`).

## Movement and smoothness (responsibility split)

- **Backend = logic and discrete cells.** It reports each agent's current cell `(x, y)` per tick. (In v0 the prototype's tick function plays this role inside the browser.)
- **Frontend = visual interpolation.** The client keeps its own visual position per agent and animates it toward the reported cell (CSS `transform` transition ≈ tick interval), so characters **glide and never teleport**. The transition duration is tuned per character (the prototype glides Лілі over ~0.7 s and the snappier player over ~0.18 s). If a state poll is late, the client keeps interpolating to the last known cell.

## Transport — REST polling

Chosen over WebSocket for simplicity and to pass through firewalls/proxies (plain HTTPS GET/POST; no long-lived connections). WebSocket/SSE push remains an optional later optimization (Deferred).

- `GET /world` — the static world (floor plan, rooms, items), fetched once at start.
- `GET /state` — the full dynamic state, polled once per tick (~1–2 s).
- `POST /move` — moves the user's character one cell (validated against the walkable grid).
- `POST /chat` — an in-character reply from the addressed agent.
- *(later)* `GET /journal`, `POST /agents`, etc.

## Contracts

### REST endpoints (from v2)

- `GET /world → World` — static; fetched once.
- `GET /state → State` — dynamic; polled each tick.
- `POST /move {dir: "up"|"down"|"left"|"right"} → {ok, x, y}` — moves the user one cell if the target cell is walkable; otherwise a no-op.
- `POST /chat {agent_id, text} → {reply}` — an in-character reply from the addressed agent, grounded in its live context.

### Data model

- **World** — `{ W, H, tiles: Tile[][], rooms: { [key]: Room } }`.
- **Tile** — `{ kind: "wall"|"floor"|"door", room?: string, item?: string }` (`item` is the prop/object glyph on that cell).
- **Room** — `{ name, floor, color, verb, desc }` — `name` (Ukrainian), `floor` (pastel tile color), `color` (accent for room cards), `verb` (the action word, e.g. "малює"), `desc` (atmospheric interior description).
- **State** — `{ time, day, agents: AgentState[] }`.
- **AgentState (in `/state`)** — `{ id, name, x, y, room, action, voice }` — the wire shape the frontend renders.
- **Agent (backend internal)** — AgentState `+ { canon, drives: {inspiration, calm, energy, warmth}, target, acting }`.
- **Object (drive target)** — `{ x, y, glyph, room }`; the lowest-drive room's object is an agent's target.
- **(v3) Persisted** — world snapshot `{ time, day, agents:[{id, drives, x, y}] }` and per-agent `MemoryItem{ agent_id, text, with, ts }` (a light record of an encounter).

### Chat (conceptual)

The backend builds the system prompt from the agent's **canon** + **live context** (its room, its action, the user's room, whether they are together) and a short history → an in-character reply. Replies are **short, in Ukrainian, in the agent's voice — no lists, no emoji.**

## Voice (model)

- A language model (Anthropic, Claude) generates in-character chat replies and, from v2.1, ambient and inter-agent lines. The system prompt is assembled on the backend from the agent's canon plus **live context**: its room, its current action, the user's room, whether they are together.
- The model is **switchable**; a **cheaper model** is used for the high-volume ambient/inter-agent lines, the main model for direct chat.
- In v0 the chat call is made directly from the frontend; from **v1.4** it is server-side (telnet `tell`), and from **v2.5** it is exposed over `POST /chat` — the key stays server-side from v1.

## Error handling and resilience

- **Missed poll (frontend).** If a `/state` poll fails or is late, the client keeps interpolating to the last known cell and retries with backoff; a brief outage never teleports a sprite.
- **Backend unreachable.** The frontend surfaces a non-fatal "reconnecting" state and resumes polling when the server returns; player input is paused while offline.
- **LLM failure/timeout (chat).** A failed or slow chat call returns a short graceful in-character fallback rather than breaking the turn; ambient/inter-agent lines are best-effort and simply skipped on failure (the simulation never blocks on the model).
- **Invalid `/move`.** A move into a non-walkable cell or out of bounds is a no-op; the backend returns the unchanged position.
- **Tick independence.** The tick loop never blocks on a model call — voice generation is fire-and-forget relative to the simulation step.

## Persistence and memory (from v3)

- **v3.2 — memory and continuity.** The backend persists world state (positions, drives, clock) and per-agent memory of interactions (with the user and with each other), recalls it in chat and ambient lines, and **survives restarts** — the world resumes where it was.
- Storage is server-side (SQLite or equivalent), scoped per agent; audio is never stored (none exists). Until v3 the world is in-memory only and resets on restart.

## Security and secrets

- **API key is backend-only from v1.** It lives in server config (`.env`, gitignored) and is never shipped to the browser. In **v0 only**, the prototype calls Anthropic from the frontend with a key in the client — acceptable *only* because v0 is a local, single-user artifact and is never deployed publicly.
- **Single-presence.** Early versions assume one human (the author); there is no auth/allowlist until multi-user is considered (beyond v3).

## Stack and repository layout

```
/backend        # Python: world, agents, simulation loop, telnet server (v1), REST API (v2), LLM calls (Anthropic); holds the key
/frontend       # graphical web client (React): scene render, interpolation, input, chat; polls the backend (thin client, from v2)
/shared         # world / floor-plan definitions and contracts shared in spirit between front and back (from v2)
/specification  # MISSION.md, ARCHITECTURE.md, ROADMAP.md, PROTOTYPE_PHASE1_SPEC.md, UI_SPEC.md, TERMINAL_SERVER_SPEC.md
/tests          # automated tests (pytest for backend; component tests for frontend)
```

- **v0 (prototype, implemented):** a single self-contained React file (default component `LiliHouseAITown`, file `lili_house_aitown.jsx`) — the whole world in the browser, no backend; pinned constants in PROTOTYPE_PHASE1_SPEC.md, UI in UI_SPEC.md.
- **From v1:** the Python backend owns the simulation and the model calls, reached over the **telnet server** (`/backend` created as v1 begins).
- **From v2:** a FastAPI **REST API** exposes the same world and the React **thin client** polls `/state` and posts actions (`/frontend`, `/shared` created as v2 begins). Today only the v0 prototype file exists; `/backend` and `/frontend` do not yet.

## Testing and CI

Automated tests ship with each version, not as an afterthought; each ROADMAP phase ships with tests encoding its DoD, and `main` stays green.

- **Backend unit tests (pytest):** world build and walkable-grid derivation, the drive decay/refill thresholds, `pickTarget` mapping (including the warmth→office special case), and BFS shortest-path/unreachable behavior.
- **Contract tests** pin the wire formats so frontend and backend cannot drift: the `/world` and `/state` shapes (§Data model) and the `/move` and `/chat` request/response schemas. Changing a contract must change its test.
- **Fakes instead of paid APIs:** a **mock LLM** adapter returns canned in-character lines so the tick loop and chat path run deterministically and offline; the real model is never called in CI.
- **Frontend:** the interpolation logic and the input/walkability guard are unit-tested; the render is verified by the per-phase DoD in ROADMAP.
- **CI** runs lint + the test suite on every push/PR; merges require green.

## How it grows

The same engine scales from one home with a small cast to a **town** (v4): more buildings, a larger map, transitions between locations, more agents, and richer inter-agent social life. The single home is the seed; the town is the same mechanics — drives, the per-tick decision loop, BFS navigation, REST polling, and the cells-vs-motion split — at a larger scale.
