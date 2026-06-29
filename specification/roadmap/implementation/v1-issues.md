# Version v1 — Issues (phase v1.1)

Fine-grained breakdown of **ROADMAP §v1.1 — Headless world & tick loop (Python)** into `HVN-xxx` issues. v1.1 **ports the v0 prototype's world + simulation** from the single React file [lili_house_aitown.jsx](../../../lili_house_aitown.jsx) into a headless **Python backend** (`/backend`) that owns and ticks the world with **no client** — no telnet (that is v1.2), no REST (that is v2.1), no browser. All issues are `area:backend`. IDs continue from v0 (HVN-001…015) at **HVN-016**.

Phase DoD (the bar all issues serve): *the backend simulates Лілі and ticks the world headless, verified by unit/integration tests over a mock clock — no client required.*

> Scope note: this file covers **v1.1 only**. The v1.2 (telnet server & observe), v1.3 (movement), and v1.4 (chat) issues are added later, before uploading them. See [TERMINAL_SERVER_SPEC.md](../../TERMINAL_SERVER_SPEC.md) for the v1 server those phases build.

> Port parity: the Python port must reproduce the prototype's pinned values exactly (grid `29×15`; drives init `78/60/52/46`, decay `−3`, refill `+17`, thresholds `4`/`94`; clock `+9` min/tick, day at `1440`; one cell/tick). Internal drive keys use the ARCHITECTURE data-model names (`inspiration`, `calm`, `energy`, `warmth`); the prototype's Ukrainian labels (`натхнення…`) become display/voice strings.

## Issues Summary Table

| ID | Title | Size | Area | Phase | Dependencies |
|----|-------|------|------|-------|--------------|
| HVN-016 | Backend scaffold & config (Python) | S | backend | v1.1 | — |
| HVN-017 | World build & derived grids (Python port) | M | backend | v1.1 | HVN-016 |
| HVN-018 | Drives & target selection (`pick_target`) | M | backend | v1.1 | HVN-017 |
| HVN-019 | BFS navigation (`bfs_next`) | S | backend | v1.1 | HVN-017 |
| HVN-020 | Per-tick decision loop & world clock (`advance`) | L | backend | v1.1 | HVN-018, HVN-019 |
| HVN-021 | Headless tick-loop runner & mock-clock harness | M | backend | v1.1 | HVN-020 |

Dependency order (topological): HVN-016 → HVN-017 → {HVN-018, HVN-019} → HVN-020 → HVN-021.

---

## HVN-016: Backend scaffold & config (Python)

**Description**
Stand up the `/backend` Python package the rest of v1.1 fills in: project metadata, the test/lint toolchain, configuration (tick interval, the Anthropic key loaded from a gitignored `.env` — unused until v1.4), and a runnable module entrypoint stub. No world logic yet.

**What needs to be done**
- Create `/backend` as a Python package with `pyproject.toml` (Python ≥ 3.11), dependencies kept minimal (stdlib-first; `pytest`, `ruff` as dev deps; `python-dotenv` or equivalent for `.env`).
- `backend/config.py`: settings via env — `HAVEN_TICK_MS` (default `1000`), and `ANTHROPIC_API_KEY` read from `.env` (gitignored) and **held server-side only** (not used in v1.1; wired in v1.4).
- `backend/__main__.py`: a `python -m backend` entrypoint stub (prints a startup banner; the real tick loop arrives in HVN-021).
- Set up `pytest` (tests under `backend/tests/`) and `ruff`; one trivial passing test to prove the harness.

**Dependencies**
None — this is the backend foundation.

**Expected result**
`python -m backend` runs (banner), `pytest` and `ruff check` pass on an empty-but-wired package; config reads `HAVEN_TICK_MS` and the key from `.env`.

**Acceptance criteria**
- [ ] `/backend` is an importable package with `pyproject.toml`; `python -m backend` runs without error.
- [ ] `config.py` exposes the tick interval and the Anthropic key (from gitignored `.env`); the key is never logged.
- [ ] `pytest` (in `backend/tests/`) and `ruff check` run green with a trivial test.

---

## HVN-017: World build & derived grids (Python port)

**Description**
Port the static world from the prototype: the procedural floor plan, the derived passability/room grids, and the room/object/decor content tables.

**What needs to be done**
- Port `compute_wall_map` (from `computeWallMap`): the `H×W` (`15×29`) char grid with the six rooms carved at their exact inclusive interiors and the five doors opened; expose `ROOM_RECTS`, `DOORS`, and the `LETTER` letter→room-key map.
- Port `derive_walkable`, `derive_room_grid` (doors adopt the adjacent non-hall room), and `room_at(x, y)` (hall fallback) — memoized/derived once.
- Port the content tables: `ROOMS` (key → name/floor/color/verb/desc, Ukrainian), `OBJECTS` (5 interactive drive targets at their pinned cells), `DECOR` (~24 props), and the merged `ITEM["x,y"]` lookup. Keep the exact coordinates/values from the prototype.

**Dependencies**
HVN-016 (the package and tooling).

**Expected result**
The Python world module reproduces the prototype's floor plan, walkable/room grids, and content tables byte-for-byte in meaning (same coords, same room keys), with the hall connecting every room.

**Acceptance criteria**
- [ ] Six rooms at their exact inclusive interiors; five doors at the exact cells; hall connects every room (flood-fill test).
- [ ] `walkable`/`room_grid`/`room_at` match the prototype's rules (doors → adjacent non-hall room; walls → hall fallback).
- [ ] `ROOMS`/`OBJECTS`/`DECOR`/`ITEM` carry the exact values; objects sit on walkable cells in their room.
- [ ] pytest covers coords, doors, connectivity, grids, and content.

---

## HVN-018: Drives & target selection (`pick_target`)

**Description**
Port the drive state and the lowest-drive→room target mapping, including the warmth→office special case (dormant until a player exists in v1.3).

**What needs to be done**
- Port the drive tunables and helpers: initial `78/60/52/46`, `DECAY=3`, `REFILL=17`, `ACT_TICKS_MAX=4`, `DRIVE_FULL=94`; `clamp`, `decay_drives`, `refill_drive`, `action_done`, `lowest_drive`.
- Internal keys are the ARCHITECTURE names (`inspiration`, `calm`, `energy`, `warmth`); keep a mapping to the Ukrainian display labels.
- Port `pick_target(drives, user_room=None)`: lowest drive → room (`inspiration→art`, `energy→sleep`, `calm→bath`, `warmth→kitchen`), with the **warmth→office** override when `user_room == "office"`. In v1.1 there is no player, so `user_room` is `None` and the override is inert (it activates in v1.3). Include `ROOM_DRIVE` (acting room → drive it refills, office→warmth).

**Dependencies**
HVN-017 (`OBJECTS`, room keys).

**Expected result**
Drives decay/refill per the tunables and clamp to `0..100`; `pick_target` returns the correct object for the lowest drive, with the warmth→office override available for v1.3.

**Acceptance criteria**
- [ ] Init `78/60/52/46`; clamp `0..100`; decay `−3`, refill `+17`; `action_done` at `act_ticks≥4` or drive `≥94`.
- [ ] `pick_target` maps each lowest drive to its room object; warmth→office fires only when `user_room=="office"`.
- [ ] pytest covers init, clamp, decay floor, refill cap, thresholds, the full mapping, and the override (incl. the inert-when-None case).

---

## HVN-019: BFS navigation (`bfs_next`)

**Description**
Port shortest-path stepping over the walkable grid: one cell toward a goal per call.

**What needs to be done**
- Port `bfs_next(start, goal, walkable)`: BFS with a `prev` grid, reconstruct the shortest path, return the **first step** as a plain `(x, y)`; return `start` when already there or the goal is unreachable; one 4-neighbour cell per call; never enter a wall.

**Dependencies**
HVN-017 (`walkable`).

**Expected result**
`bfs_next` returns the correct adjacent cell on the shortest path toward any reachable goal, and `start` when unreachable.

**Acceptance criteria**
- [ ] Returns the first step of a shortest path; returns `start` when unreachable/already reached.
- [ ] One 4-neighbour cell per call; never a wall.
- [ ] pytest: hand-checked cross-room pairs route through the hall; an unreachable case on a hand-built grid returns `start`.

---

## HVN-020: Per-tick decision loop & world clock (`advance`)

**Description**
Port the heart of the simulation: the pure per-tick decision loop (decay → act/move/pick-target → voice) plus the world clock — deterministic for a fixed RNG so it is fully testable.

**What needs to be done**
- Port `advance(state, *, walkable, room_at, rng)` (from `advance`): (1) clock `+9` min/tick, new day at `1440`; (2) decay all drives; (3) determine Лілі's room and `with_you` (always false in v1.1 — no player yet); (4) if acting: `act_ticks++`, refill the target drive, set `action = "<verb> (<room>)"`, end at the threshold; (5) else if a target: act on arrival (take a room voice line) else step via `bfs_next` (`action = "йде до: <room>"`); (6) else `pick_target`; (7) a new non-`"…"` line updates the spoken line and the rolling last-N log.
- Port the `VOICE` pools (fixed Ukrainian per-room lines + `you`; `hall="…"`) and `fmt_time`; constants `MIN_PER_TICK=9`, `DAY_MIN=1440`, `LOG_LEN=5`.
- RNG is injectable (default `random`) so tests are deterministic. The `you`-pool / `with_you` branches port but stay inert until a player exists (v1.3).
- Define the world/agent state container (Лілі: position, acting, act_ticks; target; action; voice; log; clock) — single agent in v1.1 (multiple agents are v2.3).

**Dependencies**
HVN-018 (drives, `pick_target`), HVN-019 (`bfs_next`).

**Expected result**
With a fixed RNG, repeated `advance` calls walk Лілі to her lowest-drive room, act on arrival (refilling the matching drive), emit voice lines, and roll the clock/day — fully deterministic.

**Acceptance criteria**
- [ ] Clock `+9`/tick, new day at `1440`; drives decay/refill as specified.
- [ ] decide→move→act loop matches the prototype's steps; reaching a target starts acting and ends at the threshold, then a new target is chosen.
- [ ] New non-`"…"` lines update the spoken line and the last-`5` log with timestamps.
- [ ] pytest (deterministic RNG): clock/day roll, decay, step-toward-target, arrival→act + room line, refill + threshold end, log retention.

---

## HVN-021: Headless tick-loop runner & mock-clock harness

**Description**
Run the world headless on a fixed interval and prove it lives with no client — the v1.1 DoD. Provide a mock-clock harness so the loop is testable deterministically.

**What needs to be done**
- `backend/loop.py`: a fixed-interval runner (asyncio) that advances the world by one `advance` step every `HAVEN_TICK_MS` (default ~1 s, configurable), holding the single shared world/agent state; optional concise logging of the living world (time, Лілі's action, new voice lines).
- Wire `python -m backend` (HVN-016 stub) to start the loop; clean shutdown on SIGINT/SIGTERM.
- A **mock-clock / injectable-tick harness**: drive N deterministic ticks without real time (advance the loop manually), used by an integration test asserting the world ticks and Лілі lives (moves room→room, acts, speaks) over a fixed RNG — no client, no network, no model call.

**Dependencies**
HVN-020 (`advance` + state).

**Expected result**
`python -m backend` ticks the world continuously and headless; an integration test drives many ticks over a mock clock and asserts Лілі autonomously moves, acts, and speaks — no client required.

**Acceptance criteria**
- [ ] A fixed-interval runner advances the world by one `advance`/tick at `HAVEN_TICK_MS`; `python -m backend` runs it; clean shutdown.
- [ ] A mock-clock harness drives deterministic ticks without real time.
- [ ] Integration test (mock clock + fixed RNG): over many ticks Лілі visits ≥2 rooms, completes ≥1 action (a drive refills past its decayed value), and emits ≥1 voice line — entirely headless.
- [ ] `pytest` + `ruff check backend` green.

---

## Notes for `/upload-issues`

- Run `/upload-issues @specification/roadmap/implementation/v1-issues.md` to push these to GitHub.
- Label prefix: `v1::`. Area label used: `v1::area:backend`. Sizes: S/M/L per the table.
- This is **version v1, phase v1.1** — new label set `v1::` (distinct from the v0 labels). IDs continue at HVN-016.
- After upload, a `v1-github-report.md` records the HVN→GitHub# mapping; `/execute-issues v1::version:1` then implements them in dependency order (backend validation: `pytest` + `ruff`).
