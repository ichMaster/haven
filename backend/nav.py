"""Navigation: shortest-path stepping over the walkable grid.

Ported from the v0 prototype (``lili_house_aitown.jsx`` §9). One cell per call.
Cells are ``(x, y)`` tuples.
"""

from __future__ import annotations

from collections import deque

Cell = tuple[int, int]
_NEI = ((1, 0), (-1, 0), (0, 1), (0, -1))


def bfs_next(start: Cell, goal: Cell, walkable: list[list[bool]]) -> Cell:
    """Return the next cell on a shortest path from ``start`` to ``goal``.

    Returns ``start`` when already there or the goal is unreachable. One
    4-neighbour cell per call; never enters a wall.
    """
    sx, sy = start
    gx, gy = goal
    if (sx, sy) == (gx, gy):
        return (sx, sy)
    h = len(walkable)
    w = len(walkable[0])
    prev: list[list[Cell | None]] = [[None] * w for _ in range(h)]
    seen = [[False] * w for _ in range(h)]
    q: deque[Cell] = deque([(sx, sy)])
    seen[sy][sx] = True
    found = False
    while q:
        cx, cy = q.popleft()
        if (cx, cy) == (gx, gy):
            found = True
            break
        for dx, dy in _NEI:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and walkable[ny][nx]:
                seen[ny][nx] = True
                prev[ny][nx] = (cx, cy)
                q.append((nx, ny))
    if not found:
        return (sx, sy)  # unreachable
    # Walk the prev-chain back from goal until the cell whose parent is start.
    node: Cell = (gx, gy)
    p = prev[gy][gx]
    while p is not None and p != (sx, sy):
        node = p
        p = prev[node[1]][node[0]]
    return node
