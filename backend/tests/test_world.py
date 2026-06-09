"""HVN-017 — world build & derived grids (Python port)."""

from backend import world
from backend.world import (
    DECOR,
    DOORS,
    ITEM,
    LETTER,
    OBJECTS,
    ROOM_RECTS,
    ROOMS,
    H,
    W,
    compute_wall_map,
    derive_room_grid,
    derive_walkable,
    make_room_at,
)

WALL_MAP = compute_wall_map()
WALKABLE = derive_walkable(WALL_MAP)
ROOM_AT = make_room_at(derive_room_grid(WALL_MAP))


def _flood(grid, sx, sy):
    seen = set()
    stack = [(sx, sy)]
    while stack:
        x, y = stack.pop()
        if not (0 <= x < W and 0 <= y < H) or grid[y][x] == "#" or (x, y) in seen:
            continue
        seen.add((x, y))
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return seen


def test_grid_dimensions():
    assert len(WALL_MAP) == H
    assert all(len(row) == W for row in WALL_MAP)


def test_rooms_carved_and_doors_open():
    for ch, (x0, y0, x1, y1) in ROOM_RECTS.items():
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                assert WALL_MAP[y][x] == ch, (x, y, ch)
    assert DOORS == [(11, 3), (11, 10), (16, 2), (16, 7), (16, 12)]
    for x, y in DOORS:
        assert WALL_MAP[y][x] == "+"


def test_hall_connects_every_room():
    seen = _flood(WALL_MAP, 1, 1)  # a studio cell
    for ch, (x0, y0, x1, y1) in ROOM_RECTS.items():
        assert (x0, y0) in seen or (x1, y1) in seen, ch


def test_walkable_and_letter():
    assert WALKABLE[1][1] is True  # studio
    assert WALKABLE[3][12] is True  # hall
    assert WALKABLE[3][11] is True  # a door
    assert WALKABLE[0][0] is False  # wall
    non_wall = sum(ch != "#" for row in WALL_MAP for ch in row)
    walk = sum(c for row in WALKABLE for c in row)
    assert walk == non_wall
    assert LETTER == {
        "A": "art", "K": "kitchen", "H": "hall", "S": "sleep", "O": "office", "V": "bath",
    }


def test_room_grid_doors_and_room_at():
    rg = derive_room_grid(WALL_MAP)
    assert rg[1][1] == "art"
    assert rg[1][12] == "hall"
    assert rg[7][17] == "office"
    assert rg[0][0] is None  # wall
    # doors resolve to the adjacent non-hall room
    assert rg[3][11] == "art"
    assert rg[10][11] == "kitchen"
    assert rg[2][16] == "sleep"
    assert rg[7][16] == "office"
    assert rg[12][16] == "bath"
    assert ROOM_AT(1, 1) == "art"
    assert ROOM_AT(0, 0) == "hall"  # wall fallback
    assert ROOM_AT(-1, 5) == "hall"  # off-grid
    assert world.room_at(12, 1) == "hall"  # module-level derived


def test_rooms_content():
    expected = {
        "hall": ("#ece2cf", "#6b7280", "йде"),
        "office": ("#cfe0f2", "#3b6fb0", "поруч із тобою"),
        "art": ("#e6d6f2", "#7a52b0", "малює"),
        "sleep": ("#f0d9ec", "#c0518f", "спить"),
        "kitchen": ("#f1e7c0", "#b0832a", "на кухні"),
        "bath": ("#cfe9e6", "#2a8f93", "у ванні"),
    }
    assert set(ROOMS) == set(expected)
    for key, (floor, color, verb) in expected.items():
        assert ROOMS[key]["floor"] == floor
        assert ROOMS[key]["color"] == color
        assert ROOMS[key]["verb"] == verb
        assert len(ROOMS[key]["name"]) > 0
        assert len(ROOMS[key]["desc"]) > 10


def test_objects_walkable_and_in_room():
    by_room = {o["room"]: o for o in OBJECTS}
    assert len(OBJECTS) == 5
    assert (by_room["art"]["x"], by_room["art"]["y"], by_room["art"]["glyph"]) == (5, 3, "🎨")
    assert (by_room["office"]["x"], by_room["office"]["y"]) == (20, 7)
    for o in OBJECTS:
        assert WALKABLE[o["y"]][o["x"]] is True
        assert ROOM_AT(o["x"], o["y"]) == o["room"]


def test_decor_and_item_merge():
    assert len(DECOR) >= 20
    per_room: dict[str, int] = {}
    for d in DECOR:
        per_room[d["room"]] = per_room.get(d["room"], 0) + 1
        assert WALKABLE[d["y"]][d["x"]] is True
    for r in ("art", "sleep", "office", "kitchen", "bath", "hall"):
        assert per_room.get(r, 0) >= 3
    for o in OBJECTS:
        assert ITEM[f"{o['x']},{o['y']}"] == o["glyph"]
    assert len(ITEM) == len(OBJECTS) + len(DECOR)
