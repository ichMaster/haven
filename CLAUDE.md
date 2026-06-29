# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

The **v0 graphical prototype is implemented**: a single self-contained React file [lili_house_aitown.jsx](lili_house_aitown.jsx) (default component `LiliHouseAITown`) with a minimal Vite/Vitest harness — `npm run dev` (dev server), `npm run build` (production bundle), `npm test` (Vitest suite). Everything else is design documents under [specification/](specification/) plus `LICENSE` / `.gitignore`. The next implementation work is **v1** (the headless Python backend world + telnet server). No `/backend` or `/frontend` directory exists yet.

The spec documents are the source of truth for what Haven is and what to build next. Read them before implementing:
- [specification/MISSION.md](specification/MISSION.md) — what Haven is, principles, non-goals, glossary.
- [specification/ARCHITECTURE.md](specification/ARCHITECTURE.md) — components, world model, REST contracts, stack/layout.
- [specification/ROADMAP.md](specification/ROADMAP.md) — dotted phases `vA.B` (v0 prototype → v1 living world & terminal server → v2 REST API, web client & multiple agents → v3 richer life → v4 town), each with a Goal, Tasks, and a Definition of Done. When asked to "implement `v2.2`", treat its DoD as acceptance criteria, its Tasks as the work list, and the ARCHITECTURE contracts as the interface to honor.
- [specification/PROTOTYPE_PHASE1_SPEC.md](specification/PROTOTYPE_PHASE1_SPEC.md) — the detailed, parameter-level spec for the v0.1 prototype (the single React file `lili_house_aitown.jsx`); it pins every concrete value.
- [specification/UI_SPEC.md](specification/UI_SPEC.md) — the v0 prototype's on-screen UI in detail (layout, panels, town map, navigation, parameters).
- [specification/TERMINAL_SERVER_SPEC.md](specification/TERMINAL_SERVER_SPEC.md) — the v1 TCP/telnet server: architecture, protocol, commands, features.

Note: the planned `/backend` directory (ARCHITECTURE §Stack and repository layout) is created as **v1** begins; `/frontend` and `/shared` as **v2** begins.

## Project skills (ROADMAP → GitHub → implement → release)

Three user-invocable skills under `.claude/skills/` drive the build pipeline. Issue IDs are prefixed `HVN-`; version labels are `v{n}::…`; the per-version breakdowns and reports live under `specification/roadmap/implementation/` (created on demand).

- **`/upload-issues <version-issues-file>`** — split a ROADMAP version's `vA.B` phases into `HVN-xxx` GitHub issues with version-prefixed labels (`area:` ∈ frontend/backend/shared) and dependency comments; writes a `v{N}-github-report.md`.
- **`/execute-issues <label> [--issue HVN-xxx] [--dry-run]`** — implement the version's issues in dependency order: code → validate (`pytest` + contract tests + `ruff`; frontend component tests) → commit (`Closes #…`) → push → close, then a `v{N}-execution-report.md`. Does **not** bump the version without explicit confirmation.
- **`/release-version <version> [changelog…]`** — bump the version, prepend a `RELEASE.txt` entry, commit, annotated-tag, and push. Semver maps from the phase: `vA.B` → `A.B.0`, post-release fix bumps `C`.

## What Haven is

A graphical, top-down web world (AI Town style) — a *place*, not a chatbot. Autonomous characters (Лілі / Lili is one of several) live by their own drives in a multi-room home; the user is present as their own character, walks the same space, and talks to inhabitants in character. The characters live whether or not the user interacts.

## Architecture (the model to implement)

The system is split so that **the backend owns the world and the frontend only renders it**. Understanding this split is the key to the whole design:

- **Backend (FastAPI, Python).** Owns the floor plan and walkable grid, the set of agents, the simulation loop, and **all language-model calls (Anthropic / Claude)**. Holds the API key — it must never reach the frontend. Advances the world in discrete **ticks** (~1 s); each tick runs every agent's decision loop for at most one grid cell of movement. Works purely in **grid cells**, never pixels.
- **Frontend (React graphical client).** Thin client: fetches the static world once, polls dynamic state each tick, renders the top-down scene (floors, walls, item props, sprites, name tags, speech bubbles, day/night), and takes player input. **Visual interpolation lives only here** — the client animates each sprite toward the cell the backend last reported (transition ≈ tick interval) so characters glide and never teleport.

Mantra from the specs: **"Backend in cells, frontend in motion."** When implementing movement, keep logic/positions on the backend in integer cells and keep all smoothing/animation on the frontend.

### Agents and the simulation

- An agent is `{ id, name, canon, drives, x, y, target, action, voice }`. Лілі is one of several inhabitants.
- **Drives:** `inspiration`, `calm`, `energy`, `warmth`, each 0..100, decaying every tick.
- **Decision loop per agent per tick:** decay drives → if currently acting, refill the active drive until satisfied → else if a target is set, step one cell toward it via **BFS** on the walkable grid → else pick a new target = the drive-satisfying object of the agent's *lowest* drive (per that agent's drive→room mapping). Лілі's mapping (`pickTarget`): inspiration→studio, energy→bedroom, calm→bathroom, warmth→kitchen — **except** when the lowest drive is `warmth` *and* the user is in the office, the target becomes the office (Лілі comes to you).
- **Inter-agent interaction (v2.4+):** when two agents share a room, with some probability they exchange a short in-character line via a **cheaper** model; light memory of the encounter.

### REST contracts (no WebSocket — plain HTTPS polling, by design)

- `GET /world` — static world, fetched once: `{ W, H, tiles: [{kind: wall|floor|door, room?, item?}], rooms }`.
- `GET /state` — dynamic state, polled each tick: `{ time, day, agents: [{ id, name, x, y, room, action, voice }] }`.
- `POST /move` — `{ dir }`, moves the user's character one cell (validated against the walkable grid).
- `POST /chat` — `{ agent_id, text }` → `{ reply }`, an in-character reply from the addressed agent.

### Voice (model) conventions

- The backend assembles each system prompt from the agent's **canon** plus **live context** (its room, its action, the user's room, whether they are together).
- Replies are **short, in Ukrainian, in the agent's voice — no lists, no emoji.**
- The model is switchable; use a **cheaper model** for ambient and inter-agent lines, the main model for direct chat.

## Build order (per ROADMAP)

- **v0 — graphical prototype:** a self-contained React artifact with one autonomous Лілі, smooth interpolation, room descriptions, and chat calling Anthropic directly from the frontend (no backend yet). Roadmap marks it done, but the file is **not yet committed** — `lili_house_aitown.jsx` is fully specified in `PROTOTYPE_PHASE1_SPEC.md` and is the concrete thing to build first. Phase 1 (graphical home + autonomous Лілі) is in scope there; Phase 2 (in-character chat) is out of scope for that file.

  Pinned prototype constants (all editable, see the spec's "Parameters for quick edits"): single React file, default component `LiliHouseAITown`, rendered as one SVG; grid `W=29 × H=15`, `TILE=24`px; 6 rooms (studio `A`, kitchen `K`, hall `H` spine, bedroom `S`, office `O`, bathroom `V`) carved by `computeWallMap` with doors connecting every room through the central hall; drives `{ натхнення, спокій, енергія, тепло }` init `78/60/52/46`, decay `−3`/tick, refill `+17`/tick, action ends at `actTicks≥4` or drive `≥94`; `bfsNext` steps one cell/tick; tick pace `setInterval(tick, 850)`; sprites glide via CSS `transform` transitions (Лілі `0.7s`, player `0.18s`) — the frontend-interpolation principle in miniature. In-app strings (room names, voice) are Ukrainian by design.
- **v1 — living world & terminal (telnet) server:** port the world/grid/drives/decision-loop/BFS/clock to a headless Python backend behind a tick loop; expose it over a telnet command server where you control your character (observe → move → talk to Лілі, in text). See TERMINAL_SERVER_SPEC.md.
- **v2 — REST API, web client + multiple agents:** add a FastAPI REST API over the v1 world (`GET /world`, `/state`, `POST /move`, `POST /chat`); the browser becomes a thin polling client; generalize to multiple agents; add inter-agent interaction.
- Later: **v3** model-generated ambient voice, persistent memory/continuity, day/night mood; **v4** scaling out to a town.

## Conventions and non-goals to respect

- **Graphical web is the product** — the browser scene is canonical from v0; the **v1 telnet server is an additional protocol** over the same world, not a TUI replacement.
- **Not a 3D engine** — drawn 2D top-down; emoji/drawn props in the prototype.
- **The API key is backend-only** from v1 onward.
- **Single-user / personal** in early versions; no public multi-user access.
- Haven is distinct from the **Lumi** project (a chat persona); do not conflate them.
