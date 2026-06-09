"""HVN-019 — BFS navigation (bfs_next)."""

from backend.nav import bfs_next
from backend.world import OBJECTS, WALKABLE, room_at

_obj = {o["room"]: (o["x"], o["y"]) for o in OBJECTS}


def _adjacent(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) == 1


def _walk(start, goal, cap=200):
    path = [start]
    cur = start
    for _ in range(cap):
        if cur == goal:
            return path
        nxt = bfs_next(cur, goal, WALKABLE)
        if nxt == cur:
            break
        path.append(nxt)
        cur = nxt
    return path


def test_already_at_goal():
    assert bfs_next((5, 3), (5, 3), WALKABLE) == (5, 3)


def test_adjacent_goal_is_first_step():
    assert bfs_next((5, 3), (6, 3), WALKABLE) == (6, 3)


def test_one_walkable_step():
    start, goal = _obj["art"], _obj["bath"]
    nxt = bfs_next(start, goal, WALKABLE)
    assert _adjacent(start, nxt)
    assert WALKABLE[nxt[1]][nxt[0]] is True


def test_cross_house_walk_through_hall():
    start, goal = _obj["art"], _obj["bath"]
    path = _walk(start, goal)
    assert path[-1] == goal
    for a, b in zip(path, path[1:], strict=False):
        assert _adjacent(a, b)
        assert WALKABLE[b[1]][b[0]] is True
    assert any(room_at(x, y) == "hall" for x, y in path)


def test_studio_to_kitchen_routes_through_hall():
    path = _walk(_obj["art"], _obj["kitchen"])
    assert path[-1] == (5, 11)
    assert any(room_at(x, y) == "hall" for x, y in path)


def test_unreachable_returns_start():
    grid = [
        [True, True, False],
        [True, True, False],
        [False, False, True],
    ]
    assert bfs_next((0, 0), (2, 2), grid) == (0, 0)
