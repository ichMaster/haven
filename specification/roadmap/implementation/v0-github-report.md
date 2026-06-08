# Version v0 — GitHub Issues Report

**Uploaded:** 2026-06-07
**Repository:** https://github.com/ichMaster/haven
**Total issues:** 11
**Phase covered:** v0.1 (Graphical home and autonomous Лілі)

## Issue Mapping

| HVN ID | GitHub # | Title | Phase | Labels | URL |
|--------|----------|-------|-------|--------|-----|
| HVN-001 | #1 | Project scaffold & technical basis | v0.1 | v0::version:0, v0::size:S, v0::area:frontend | https://github.com/ichMaster/haven/issues/1 |
| HVN-002 | #2 | World floor plan (`computeWallMap`) | v0.1 | v0::version:0, v0::size:M, v0::area:frontend | https://github.com/ichMaster/haven/issues/2 |
| HVN-003 | #3 | Derived grids (`walkable`, `roomGrid`, `roomAt`) | v0.1 | v0::version:0, v0::size:S, v0::area:frontend | https://github.com/ichMaster/haven/issues/3 |
| HVN-004 | #4 | Rooms, objects, decor & voice config | v0.1 | v0::version:0, v0::size:M, v0::area:frontend | https://github.com/ichMaster/haven/issues/4 |
| HVN-005 | #5 | Drives & target selection (`pickTarget`) | v0.1 | v0::version:0, v0::size:M, v0::area:frontend | https://github.com/ichMaster/haven/issues/5 |
| HVN-006 | #6 | BFS navigation (`bfsNext`) | v0.1 | v0::version:0, v0::size:S, v0::area:frontend | https://github.com/ichMaster/haven/issues/6 |
| HVN-007 | #7 | Simulation tick & pause/step controls (`tick`) | v0.1 | v0::version:0, v0::size:L, v0::area:frontend | https://github.com/ichMaster/haven/issues/7 |
| HVN-008 | #8 | SVG scene rendering (tiles, props, sprites, bubble, day/night) | v0.1 | v0::version:0, v0::size:L, v0::area:frontend | https://github.com/ichMaster/haven/issues/8 |
| HVN-009 | #9 | Smooth sprite interpolation (no teleporting) | v0.1 | v0::version:0, v0::size:S, v0::area:frontend | https://github.com/ichMaster/haven/issues/9 |
| HVN-010 | #10 | Player presence & keyboard movement | v0.1 | v0::version:0, v0::size:M, v0::area:frontend | https://github.com/ichMaster/haven/issues/10 |
| HVN-011 | #11 | Surrounding UI (drive bars, action line, room cards, event log) | v0.1 | v0::version:0, v0::size:M, v0::area:frontend | https://github.com/ichMaster/haven/issues/11 |

## Dependencies (recorded as `Blocked by` comments)

| Issue | Blocked by |
|-------|------------|
| #2 (HVN-002) | #1 |
| #3 (HVN-003) | #2 |
| #4 (HVN-004) | #2 |
| #5 (HVN-005) | #3, #4 |
| #6 (HVN-006) | #3 |
| #7 (HVN-007) | #4, #5, #6 |
| #8 (HVN-008) | #3, #4, #7 |
| #9 (HVN-009) | #8 |
| #10 (HVN-010) | #7, #8 |
| #11 (HVN-011) | #5, #7 |

Dependency order (topological): #1 → #2 → {#3, #4} → {#5, #6} → #7 → #8 → {#9, #10, #11}.

## Labels Created

- v0::version:0 — Version v0 — Graphical prototype (autonomous Лілі)
- v0::size:S, v0::size:M, v0::size:L
- v0::area:frontend

## Next step

Run `/execute-issues v0::version:0` to implement these in dependency order.
