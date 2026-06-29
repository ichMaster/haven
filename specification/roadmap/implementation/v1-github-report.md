# Version v1 — GitHub Issues Report

**Uploaded:** 2026-06-09
**Repository:** https://github.com/ichMaster/haven
**Total issues:** 6
**Phase covered:** v1.1 (Headless world & tick loop, Python)

## Issue Mapping

| HVN ID | GitHub # | Title | Phase | Labels | URL |
|--------|----------|-------|-------|--------|-----|
| HVN-016 | #16 | Backend scaffold & config (Python) | v1.1 | v1::version:1, v1::size:S, v1::area:backend | https://github.com/ichMaster/haven/issues/16 |
| HVN-017 | #17 | World build & derived grids (Python port) | v1.1 | v1::version:1, v1::size:M, v1::area:backend | https://github.com/ichMaster/haven/issues/17 |
| HVN-018 | #18 | Drives & target selection (`pick_target`) | v1.1 | v1::version:1, v1::size:M, v1::area:backend | https://github.com/ichMaster/haven/issues/18 |
| HVN-019 | #19 | BFS navigation (`bfs_next`) | v1.1 | v1::version:1, v1::size:S, v1::area:backend | https://github.com/ichMaster/haven/issues/19 |
| HVN-020 | #20 | Per-tick decision loop & world clock (`advance`) | v1.1 | v1::version:1, v1::size:L, v1::area:backend | https://github.com/ichMaster/haven/issues/20 |
| HVN-021 | #21 | Headless tick-loop runner & mock-clock harness | v1.1 | v1::version:1, v1::size:M, v1::area:backend | https://github.com/ichMaster/haven/issues/21 |

## Dependencies (recorded as `Blocked by` comments)

| Issue | Blocked by |
|-------|------------|
| #17 (HVN-017) | #16 |
| #18 (HVN-018) | #17 |
| #19 (HVN-019) | #17 |
| #20 (HVN-020) | #18, #19 |
| #21 (HVN-021) | #20 |

Dependency order (topological): #16 → #17 → {#18, #19} → #20 → #21.

## Labels Created

- v1::version:1 — Version v1 — Living world & terminal (telnet) server
- v1::size:S, v1::size:M, v1::size:L
- v1::area:backend

## Notes

- This is **version v1, phase v1.1** — the headless Python backend world + tick loop, ported from the v0 prototype. New label set `v1::` (distinct from `v0::`). IDs continue at HVN-016.
- v1.2 (telnet server & observe), v1.3 (movement), and v1.4 (chat) are separate phases — their issues are authored and uploaded later (see TERMINAL_SERVER_SPEC.md).

## Next step

`/execute-issues v1::version:1` — implements HVN-016…021 in dependency order (backend validation: `pytest` + `ruff`).
