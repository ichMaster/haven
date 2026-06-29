# Roadmap — Haven ("Haven")

Five self-contained versions, built in order: **v0** graphical prototype → **v1** living world & terminal (telnet) server → **v2** REST API, graphical web client & multiple agents → **v3** a richer life → **v4** town. Versions are numbered from 0; phases inside a version are numbered `vA.B` (A = version, B = phase), e.g. `v2.2`. Each phase lists a **Goal**, a short description of the work, a **Tasks** list, and a **Definition of Done (DoD)**. Every phase ships with the automated tests that encode its DoD (see ARCHITECTURE §Testing and CI). The arc is deliberately: graphical prototype → headless server-owned world reachable over a text terminal → graphical web client + multiple interacting agents → richer life → town.

> **On the terminal server.** The graphical web client remains the product. The telnet command server introduced in **v1** is an additional **protocol** over the same backend world — a text/MUD front-end, not a TUI stage that replaces the graphics (see the amended non-goal in MISSION.md). The world is owned by the backend from v1; both telnet (v1) and REST (v2) are doors into it.

When asked to "implement `v2.2`" or "start v0", treat that phase's **DoD** as the acceptance criteria, its **Tasks** as the work list, and the ARCHITECTURE contracts as the interface to honor.

---

## v0 — Graphical prototype (done)

A self-contained React artifact proving the feel of the home in the AI Town graphical style — the visual and simulation seed the backend will own from v1. The whole world lives in the browser: render, simulation, and chat to Anthropic directly, no backend. The parameter-level spec is **PROTOTYPE_PHASE1_SPEC.md**; the UI is detailed in **UI_SPEC.md**. Depends on: nothing — this is the foundation.

### v0.1 — Graphical home and autonomous Лілі

**Goal:** a top-down graphical home where Лілі lives on her own and you can walk around.

A single React file builds the floor plan, runs the drive-based decision loop for one agent (Лілі), navigates her by BFS, and renders the AI Town-style scene with smooth interpolation. The full parameter set (grid, rooms, drives, voice pools, sprites, glide durations) is pinned in PROTOTYPE_PHASE1_SPEC.md.

**Tasks:**
- Build the floor plan (`computeWallMap`): carve the six differently-sized rooms (studio, kitchen, hall spine, bedroom, office, bathroom) and open the doors connecting every room through the hall.
- Derive the walkable grid and the room-per-cell grid; place interactive objects and decor props.
- Implement drives (`inspiration`, `calm`, `energy`, `warmth`) with decay/refill and an action threshold; `pickTarget` mapping the lowest drive to a room (incl. the warmth→office special case).
- Implement `bfsNext` (shortest-path, one cell per tick) and the tick loop (clock + decision loop) on an interval; add pause/step controls.
- Render the scene as SVG: walls/floors, emoji props, character sprites with name tags, a speech bubble, and a day/night overlay.
- Add **smooth sprite interpolation** via CSS `transform` transitions (Лілі ~0.7 s, player ~0.18 s) so characters glide and never teleport.
- Add player presence: keyboard movement (arrows/WASD) to adjacent walkable cells, ignored while a text field is focused.
- Show drive bars, the action line, room interior descriptions for both rooms, and an event log.

**DoD:** Лілі autonomously glides room to room by her drives; you move your own character smoothly; interior descriptions update for both her room and yours; no teleporting.

### v0.2 — In-character chat (frontend-only)

**Goal:** talk to Лілі and she answers as herself, aware of where she is and what she is doing.

A chat panel calls Anthropic directly from the frontend with a system prompt assembled from her canon plus live context (her room, her action, your room, whether you are together). Out of scope for the v0.1 prototype file; this is the v0 Phase 2 addition.

**Tasks:**
- Add a chat panel UI (input + transcript) that does not capture movement keys while focused.
- Assemble the system prompt from Лілі's canon + live context (her room/action, the user's room, together-or-not).
- Call Anthropic from the frontend; render short Ukrainian replies in her voice (no lists, no emoji).
- Handle API errors with a graceful in-character fallback.

**DoD:** you can hold a conversation with Лілі that reflects where she is and what she is doing.

---

## v1 — Living world & terminal (telnet) server

Move the world off the browser into a headless Python backend that **owns and ticks** it, and reach it through a **telnet command server**: you control your character (`ти`) and observe, move, and talk to Лілі entirely in text — no graphical client yet. The build order is deliberately **headless world first, then observe, then move, then talk** — so each layer is validated before the next. This proves "the world ticks without a browser" and gives Haven a MUD-style text front-end alongside the graphical web client that arrives in v2. Depends on: v0 (the world model, drives, BFS, decision loop, and clock are ported from the prototype).

### v1.1 — Headless world & tick loop (Python)

**Goal:** the simulation runs on a server and ticks without any client.

Port the world build, walkable grid, drives, `pickTarget`, `bfsNext`, the clock, and the per-tick decision loop from the prototype into `/backend` (Python), behind a fixed-interval tick loop. All state stays in integer cells. The Anthropic key lives in server config from here on.

**Tasks:**
- Port `computeWallMap`, the derived grids, drives, `pickTarget`, `bfsNext`, the clock, and the decision loop to `/backend` (Python).
- Run a tick loop advancing the world on a fixed interval (~1 s); keep all state in cells.
- Keep the Anthropic key in server `.env` (gitignored).

**DoD:** the backend simulates Лілі and ticks the world headless, verified by unit/integration tests over a mock clock — no client required.

### v1.2 — Telnet server & observation commands

**Goal:** connect over telnet and watch the living world as text.

An asyncio TCP server accepts telnet sessions over the shared world; a line-based command parser handles read commands and pushes live, location-scoped event narration. Opt-in via env, plaintext, telnet IAC negotiation stripped.

**Tasks:**
- Stand up an `asyncio.start_server` TCP listener sharing the world singleton; session lifecycle; minimal telnet handling (strip IAC), line mode, a `>` prompt; opt-in via `HAVEN_TELNET`.
- Implement observation commands as text renderers over the world (EN canonical + UA aliases): `look`/`l`, `look <agent>`, `map`/`m`, `who`, `time`, `drives [agent]`, `help`, `quit`.
- Push live event narration (an agent's ambient line, arrivals/departures) scoped to the session's current location; `verbose`/`quiet` toggle.

**DoD:** `telnet`-ing in shows the living world — where you are, who's around, the map — and narrates events as they happen, with no browser.

### v1.3 — Player presence & movement (telnet)

**Goal:** you control your character (`ти`) from the terminal.

The session **is** the user character. Movement commands step one walkable cell; the world reacts to where you are (e.g. `withYou`, the warmth→office case).

**Tasks:**
- Bind the session to the player presence; `n`/`s`/`e`/`w` (and `move <dir>`) step one cell, validated against the walkable grid (reject walls/bounds).
- `go`/`travel` between locations (one home for now; more in v4.1).
- Expose the player's room to the simulation so drives react to your location.

**DoD:** you walk `ти` around the home over telnet; movement into walls/bounds is rejected; the world responds to your location.

### v1.4 — In-character chat over telnet

**Goal:** talk to Лілі from the terminal and she answers as herself.

`say <text>` speaks in your location; `tell <agent> <text>` addresses an agent and gets an in-character model reply, with the prompt assembled **server-side** from canon + live context (her room/action, your room, together-or-not). The key is backend-only.

**Tasks:**
- Implement `say` (local) and `tell <agent> <text>` (addressed); assemble the system prompt server-side (canon + that agent's live context + short history).
- Call the model server-side; show a "друкує…" indicator then the reply line; graceful in-character fallback on error.
- Keep the model switchable (main model for direct chat).

**DoD:** you hold a conversation with Лілі over telnet, grounded in where she is and what she is doing; the key never leaves the server.

---

## v2 — REST API, graphical web client & multiple agents

Expose the v1 backend world over **REST** and build the thin graphical web client off it; then populate the world with several interacting characters. The build order is deliberately **REST over the existing world → thin client → more agents → interaction → chat over REST** — so each layer is validated before the next. Depends on: v1 (the backend world + server already own and tick the world; the in-character chat logic already exists for telnet).

### v2.1 — REST API over the world

**Goal:** the same living world is queryable over HTTP.

Add a REST layer (FastAPI) over the v1 backend world: the world build, walkable grid, drives, decision loop, BFS, and clock already run from v1 — this adds the HTTP surface alongside the telnet server, both over one shared world/tick in one process.

**Tasks:**
- Add FastAPI to `/backend`; serve `GET /world` (static floor plan, rooms, items) and `GET /state` (dynamic: time, day, agents) from the existing world singleton, per the ARCHITECTURE §Data model shapes.
- Run REST and the telnet server over the same world and tick loop (one process, one world).

**DoD:** `GET /world` returns the static world and `GET /state` returns live positions and actions — from the same world the telnet server exposes.

### v2.2 — Frontend on REST polling with smooth motion

**Goal:** the graphical client runs off the backend with non-teleporting movement.

Strip the simulation out of the frontend: fetch `/world` once, poll `/state` each tick, render agents from backend positions, and keep all interpolation client-side so sprites glide. The player moves via `POST /move`.

**Tasks:**
- Fetch `/world` once at start and render the static scene from it.
- Poll `/state` each tick; render each agent from its reported cell.
- **Interpolate** motion (transition ≈ tick interval) so sprites glide between reported cells.
- Wire `POST /move {dir}` for player movement; validate against the walkable grid server-side.
- Reconnect/retry on a missed poll; keep interpolating to the last known cell during a brief outage.

**DoD:** the home renders from the backend over polling, with smooth (non-teleporting) movement, and the player moves via the API.

### v2.3 — Multiple agents

**Goal:** more than one inhabitant, each autonomous.

Generalize the single-agent loop to a set of agents, each with its own canon, drives, position, and voice; Лілі becomes one of several. Each agent gets its own drive→room mapping.

**Tasks:**
- Generalize the decision loop and tick to iterate over a set of agents.
- Give each agent its own `{ id, name, canon, drives, target, action, voice }` and per-agent drive→room mapping.
- Render all agents with name tags and per-character sprite colors; include all of them in `/state` (and in telnet `who`/`look`).

**DoD:** several characters live autonomously in the home at once, each pursuing its own drives.

### v2.4 — Basic inter-agent interaction

**Goal:** characters notice and talk to each other.

When two agents share a room, with some probability they exchange a short in-character line via a cheap-model LLM call; each remembers the encounter lightly, and their actions/voices reflect each other's presence.

**Tasks:**
- Detect co-located agents each tick; with a tunable probability trigger an encounter.
- Generate a short in-character line via the **cheaper** model; record a light memory of the encounter per agent.
- Reflect presence in actions/voices ("…, з кимось поруч"); keep it fire-and-forget so the tick never blocks.

**DoD:** agents meet in rooms and exchange brief in-character lines on their own.

### v2.5 — Chat through the REST API

**Goal:** talk to any character via the web, key server-side.

Expose the server-side chat (built for telnet in v1.4) over `POST /chat` for the web client; the frontend targets a chosen character and drops its direct Anthropic call (the v0.2 frontend chat).

**Tasks:**
- Implement `POST /chat {agent_id, text} → {reply}`, reusing the server-side prompt assembly (canon + that agent's live context + short history).
- Make the model switchable (main model for chat, cheap model for ambient/inter-agent).
- Update the frontend chat to target a chosen inhabitant and call `/chat`; remove the direct frontend Anthropic call.

**DoD:** you can converse with any inhabitant via the web; replies are grounded in that character's state and place; the key is server-side only.

---

## v3 — A richer life

Make their presence deeper. Depends on: v2 (the backend, REST/web client, agents, and chat).

### v3.1 — Model-generated ambient voice

**Goal:** living lines are alive, not a fixed pool.

Replace the prototype's fixed voice pools with short model-generated ambient lines using room/action/mood context; cache and rate-limit to keep it cheap.

**Tasks:**
- Generate short in-character ambient lines from the cheap model using room/action (and, from v3.3, mood) context.
- Cache and rate-limit generation so cost stays bounded; fall back to a pooled line on failure.

**DoD:** ambient and inter-agent lines are varied and in character.

### v3.2 — Memory and continuity

**Goal:** characters remember across sessions and the world resumes after a restart.

Persist world state and per-agent memory of interactions (with the user and each other); recall it in chat and ambient lines; survive restarts.

**Tasks:**
- Persist world state (positions, drives, clock) and per-agent `MemoryItem` records to server storage (SQLite or equivalent).
- Recall memory in the chat prompt and in ambient/inter-agent lines.
- Reload state on startup so the world resumes where it was.

**DoD:** characters recall earlier moments and the world resumes where it was after a restart.

### v3.3 — Mood and rhythm

**Goal:** days feel different.

Add a day/night rhythm and a daily mood that biases drives, tone, and choices (optionally horoscope-seeded per agent, framed as an experiment).

**Tasks:**
- Drive a day/night rhythm from the world clock (already visualized by the overlay).
- Compute a daily per-agent mood that biases drive decay/targets and voice tone (optionally horoscope-seeded, as an experiment — never affecting "competence," only presentation).
- Inject mood into prompts so tone varies day to day without breaking character.

**DoD:** behavior and tone vary day to day without breaking character.

---

## v4 — Town

Scale the same engine outward. Depends on: v2–v3 (the engine, persistence, and multi-agent social life).

### v4.1 — Larger map and locations

**Goal:** beyond one home.

Multiple buildings/locations on a larger map, transitions between them, and more rooms, objects, and outdoor places (mountains, water — Лілі's motifs).

**Tasks:**
- Extend the world model to multiple buildings/locations on a larger map; add outdoor places.
- Add transitions between locations; extend BFS/navigation and the walkable grid across them (telnet `go`/`travel` and the web map both honor them).
- Render the larger map and let the player follow characters between locations.

**DoD:** characters live across a town-scale space, and you can follow them.

### v4.2 — Richer social life and adding agents

**Goal:** a populated town with management.

More inhabitants, deeper persistent relationships, and an admin path to add/configure agents.

**Tasks:**
- Add more inhabitants; deepen encounters into relationships that persist across sessions.
- Add an admin path to add/configure agents (`POST /agents`).
- (Optionally) allow other human participants.

**DoD:** the town has several living inhabitants with ongoing relationships, and new agents can be added.

---

## Mapping of protocols and contracts

- Headless world + fixed-interval tick (backend owns the world) — v1.1.
- Telnet command protocol — observation + event narration v1.2; player movement v1.3; in-character chat (`say` / `tell`) v1.4.
- World/state REST contracts (`GET /world`, `GET /state`) — v2.1.
- Player action (`POST /move`) and frontend interpolation — v2.2.
- Multi-agent model (per-agent canon/drives/mapping) — v2.3.
- Inter-agent interaction (co-location encounters, light memory) — v2.4.
- Chat contract (`POST /chat`) — v2.5 (server-side chat logic exists from v1.4; a frontend-only chat exists from v0.2).
- Model-generated ambient/inter-agent voice — v3.1.
- Persistence (world snapshot + per-agent `MemoryItem`) — v3.2.
- Day/night + daily mood biasing — v3.3.
- Multi-location world + transitions — v4.1; agent admin (`POST /agents`) — v4.2.

## Deferred (beyond v0–v4)

WebSocket/SSE push (only if real-time beyond tick polling is needed), true pixel-art tilesets instead of drawn shapes/emoji, networked multi-user presence, and voice in/out. (The **backend-owned simulation**, **terminal server**, **multiple agents**, **inter-agent interaction**, **memory**, and **town scaling** are not deferred — they are scheduled per the versions above.)
