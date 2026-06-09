# Version v1 — Execution Report

**Date:** 2026-06-09
**Branch:** main
**Label:** v1::version:1 (phase v1.1 issues, HVN-016…021)
**Target version:** 1.1.0 (phase v1.1 — not yet released; see Version note)
**Executed by:** Claude Code

## Summary

| Status | Count |
|--------|-------|
| Completed | 6 |
| Failed | 0 |
| Skipped | 0 |
| Remaining | 0 |

All 6 issues of phase **v1.1** (Headless world & tick loop, Python) implemented, validated, committed, pushed, and closed in dependency order. The deliverable is a headless **`backend/` Python package** that owns and ticks the world with no client — ported from the v0 prototype `lili_house_aitown.jsx`. No FastAPI, no telnet, no browser (those are v2.1 / v1.2 / v2.2).

**Final validation:** `pytest` → **40/40 passing**; `ruff check backend` clean; `python -m backend` runs the living world headless.

## Issues

| # | HVN ID | Title | Phase | Status | Commit | Files | Tests |
|---|--------|-------|-------|--------|--------|-------|-------|
| 16 | HVN-016 | Backend scaffold & config (Python) | v1.1 | completed | a8c70a3 | 6 | pass (5) |
| 17 | HVN-017 | World build & derived grids (Python port) | v1.1 | completed | 6a7acc0 | 2 | pass (13) |
| 18 | HVN-018 | Drives & target selection (`pick_target`) | v1.1 | completed | 359b745 | 2 | pass (8) |
| 19 | HVN-019 | BFS navigation (`bfs_next`) | v1.1 | completed | 8a7bcc8 | 2 | pass (6) |
| 20 | HVN-020 | Per-tick decision loop & world clock (`advance`) | v1.1 | completed | 5038d79 | 2 | pass (10) |
| 21 | HVN-021 | Headless tick-loop runner & mock-clock harness | v1.1 | completed | 8821aeb | 3 | pass (4) |

Dependency order honored: #16 → #17 → {#18, #19} → #20 → #21.

## Detailed Results

### HVN-016: Backend scaffold & config
**Status:** completed · **Commit:** a8c70a3 · **Files:** `pyproject.toml`, `backend/{__init__,__main__,config}.py`, `backend/tests/test_scaffold.py`, `.env.example`
**Validation:** `python -m backend` banner; ruff clean; pytest 5/5. `config.py` exposes `TICK_MS` + server-side-only `ANTHROPIC_API_KEY` (stdlib `.env` loader, key never logged).

### HVN-017: World build & derived grids (Python port)
**Status:** completed · **Commit:** 6a7acc0 · **Files:** `backend/world.py`, `backend/tests/test_world.py`
**Validation:** 13/13 — `compute_wall_map` (exact rooms/doors), `derive_walkable`/`derive_room_grid`/`room_at`, `ROOMS`/`OBJECTS`/`DECOR`/`ITEM`; flood-fill connectivity.

### HVN-018: Drives & target selection (`pick_target`)
**Status:** completed · **Commit:** 359b745 · **Files:** `backend/drives.py`, `backend/tests/test_drives.py`
**Validation:** 8/8 — init/clamp/decay/refill/thresholds, English keys + Ukrainian `DRIVE_LABELS`, `pick_target` mapping + warmth→office override (inert when `user_room` is None).

### HVN-019: BFS navigation (`bfs_next`)
**Status:** completed · **Commit:** 8a7bcc8 · **Files:** `backend/nav.py`, `backend/tests/test_nav.py`
**Validation:** 6/6 — first step of shortest path, cross-house routing through the hall, unreachable→start.

### HVN-020: Per-tick decision loop & world clock (`advance`)
**Status:** completed · **Commit:** 5038d79 · **Files:** `backend/sim.py`, `backend/tests/test_sim.py`
**Validation:** 10/10 — pure `advance` reducer (clock/day-roll, decay, act/move/pick, spoken line + last-5 log), `VOICE`, `fmt_time`, `initial_sim`; injectable RNG; `with_you`/warmth→office inert (no player).

### HVN-021: Headless tick-loop runner & mock-clock harness
**Status:** completed · **Commit:** 8821aeb · **Files:** `backend/loop.py`, `backend/__main__.py`, `backend/tests/test_loop.py`
**Validation:** 4/4 — `World` + asyncio `run()` (fixed interval, clean shutdown) + `run_ticks` mock clock; integration test drives 150 ticks → Лілі visits ≥2 rooms, acts, speaks, headless.

## Phase v1.1 Definition of Done

> The backend simulates Лілі and ticks the world headless, verified by unit/integration tests over a mock clock — no client required.

- **Met:** the headless Python backend owns the world (floor plan, grids, drives, `pick_target`, `bfs_next`, `advance`, clock) and ticks it on a fixed interval; `python -m backend` runs it; the mock-clock integration test proves Лілі lives (moves room→room, acts, speaks) with no client, no network, and no model call.

## Notes

- **Tooling:** dev deps (pytest, ruff) run in a gitignored `.venv`; the v1.1 backend itself has **no runtime dependencies** (stdlib only). Root `pyproject.toml` carries pytest/ruff config (alongside the frontend `package.json`).
- **Port parity:** exact prototype values reproduced (grid `29×15`; drives `78/60/52/46`, decay −3/refill +17/thresholds 4·94; clock +9/day 1440). Internal drive keys are the ARCHITECTURE names (`inspiration/calm/energy/warmth`); Ukrainian is display/voice. `with_you` / warmth→office / `you`-pool are ported but **inert** (no player until v1.3).
- **Not in scope (later phases):** the telnet server (v1.2), player movement (v1.3), chat (v1.4), REST API + web client (v2). The `ANTHROPIC_API_KEY` is held server-side, unused until v1.4.
- **Version:** NOT bumped (per skill policy). When ready, `/release-version 1.1.0` cuts `1.1.0`.

## Next Steps

- v1.1 is complete. Next: **v1.2** (telnet server & observation commands) — author `v1.2`-issues and `/upload-issues`. See TERMINAL_SERVER_SPEC.md.
- Pre-existing parked items: committing the spec set (ROADMAP/MISSION/ARCHITECTURE/CLAUDE.md/UI_SPEC/TERMINAL_SERVER_SPEC + v1 issue spec/report) and the **`/release-version 0.2.0`** for v0.
