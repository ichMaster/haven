"""The static world: floor plan, derived grids, and content tables.

Ported from the v0 prototype (``lili_house_aitown.jsx`` §3–6). Coordinates and
values are reproduced exactly. The backend reasons only in integer grid cells.
"""

from __future__ import annotations

W = 29  # columns
H = 15  # rows

# Letter → room-key map for the carved rectangles.
LETTER = {
    "A": "art",  # Майстерня Лілі (studio)
    "K": "kitchen",  # Кухня
    "H": "hall",  # Хол (hub-spine)
    "S": "sleep",  # Наша спальня (bedroom)
    "O": "office",  # Мій кабінет
    "V": "bath",  # Ванна
}

# Room interiors (inclusive), char → (x0, y0, x1, y1).
ROOM_RECTS = {
    "A": (1, 1, 10, 6),  # studio (large)
    "K": (1, 8, 10, 13),  # kitchen (large)
    "H": (12, 1, 15, 13),  # hall (vertical corridor spine)
    "S": (17, 1, 27, 4),  # bedroom (wide, short)
    "O": (17, 6, 27, 9),  # office (medium)
    "V": (17, 11, 27, 13),  # bathroom (small)
}

# Door cells (walkable openings, char "+"), (x, y). Each connects a room to the
# hall, so any room-to-room path passes through the hall spine.
DOORS = [
    (11, 3),  # studio ↔ hall
    (11, 10),  # kitchen ↔ hall
    (16, 2),  # bedroom ↔ hall
    (16, 7),  # office ↔ hall
    (16, 12),  # bathroom ↔ hall
]

_NEI = ((1, 0), (-1, 0), (0, 1), (0, -1))


def compute_wall_map() -> list[list[str]]:
    """Build the H×W char grid: walls ``#``, carved rooms, opened doors ``+``."""
    grid = [["#"] * W for _ in range(H)]
    for ch, (x0, y0, x1, y1) in ROOM_RECTS.items():
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                grid[y][x] = ch
    for x, y in DOORS:
        grid[y][x] = "+"
    return grid


def derive_walkable(wall_map: list[list[str]]) -> list[list[bool]]:
    """Boolean passability: every non-wall cell (room, door, hall) is walkable."""
    return [[ch != "#" for ch in row] for row in wall_map]


def derive_room_grid(wall_map: list[list[str]]) -> list[list[str | None]]:
    """Room key per cell; a door adopts its adjacent non-hall room; walls → None."""
    grid: list[list[str | None]] = []
    for y, row in enumerate(wall_map):
        out: list[str | None] = []
        for x, ch in enumerate(row):
            if ch == "+":
                key = "hall"
                for dx, dy in _NEI:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W and 0 <= ny < H:
                        nch = wall_map[ny][nx]
                        if nch in LETTER and nch != "H":
                            key = LETTER[nch]
                            break
                out.append(key)
            else:
                out.append(LETTER.get(ch))  # room letter → key; wall "#" → None
        grid.append(out)
    return grid


def make_room_at(room_grid: list[list[str | None]]):
    """Return ``room_at(x, y)`` → room key, with ``"hall"`` off-grid or on a wall."""

    def room_at(x: int, y: int) -> str:
        if x < 0 or y < 0 or x >= W or y >= H:
            return "hall"
        return room_grid[y][x] or "hall"

    return room_at


# ── Room config (key → name/floor/color/verb/desc, Ukrainian) ────────────────
ROOMS = {
    "hall": {
        "name": "Хол",
        "floor": "#ece2cf",
        "color": "#6b7280",
        "verb": "йде",
        "desc": "Світлий хол з'єднує всі кімнати дому. Тут завжди чути кроки й тихі голоси.",
    },
    "office": {
        "name": "Мій кабінет",
        "floor": "#cfe0f2",
        "color": "#3b6fb0",
        "verb": "поруч із тобою",
        "desc": "Твій кабінет: книги, тепле світло лампи й крісло, у якому добре думається.",
    },
    "art": {
        "name": "Майстерня Лілі",
        "floor": "#e6d6f2",
        "color": "#7a52b0",
        "verb": "малює",
        "desc": "Майстерня Лілі: запах фарби, полотна під вікном і світло, що тече на мольберт.",
    },
    "sleep": {
        "name": "Наша спальня",
        "floor": "#f0d9ec",
        "color": "#c0518f",
        "verb": "спить",
        "desc": "Наша спальня: м'яке покривало, місяць у вікні й тиша, у якій легко заснути.",
    },
    "kitchen": {
        "name": "Кухня",
        "floor": "#f1e7c0",
        "color": "#b0832a",
        "verb": "на кухні",
        "desc": "Кухня пахне чаєм і свіжим хлібом; на підвіконні гріється зелень.",
    },
    "bath": {
        "name": "Ванна кімната",
        "floor": "#cfe9e6",
        "color": "#2a8f93",
        "verb": "у ванні",
        "desc": "Ванна кімната: пара, свічка й тепла вода, що змиває втому дня.",
    },
}

# Interactive drive targets — the cell Лілі walks to and acts on.
OBJECTS = [
    {"x": 5, "y": 3, "glyph": "🎨", "room": "art"},
    {"x": 22, "y": 2, "glyph": "🛏️", "room": "sleep"},
    {"x": 5, "y": 11, "glyph": "🍲", "room": "kitchen"},
    {"x": 22, "y": 12, "glyph": "🛁", "room": "bath"},
    {"x": 20, "y": 7, "glyph": "💻", "room": "office"},
]

# Non-interactive props, a few per room (~24 total), for atmosphere only.
DECOR = [
    # studio
    {"x": 1, "y": 1, "glyph": "🖼️", "room": "art"},
    {"x": 8, "y": 1, "glyph": "🖌️", "room": "art"},
    {"x": 1, "y": 6, "glyph": "🪴", "room": "art"},
    {"x": 9, "y": 3, "glyph": "🪟", "room": "art"},
    # bedroom
    {"x": 17, "y": 1, "glyph": "🪟", "room": "sleep"},
    {"x": 27, "y": 1, "glyph": "🌙", "room": "sleep"},
    {"x": 17, "y": 4, "glyph": "🪴", "room": "sleep"},
    {"x": 26, "y": 4, "glyph": "👗", "room": "sleep"},
    # office
    {"x": 17, "y": 6, "glyph": "📚", "room": "office"},
    {"x": 27, "y": 6, "glyph": "☕", "room": "office"},
    {"x": 17, "y": 9, "glyph": "🪑", "room": "office"},
    {"x": 27, "y": 9, "glyph": "🪟", "room": "office"},
    # kitchen
    {"x": 1, "y": 8, "glyph": "🫖", "room": "kitchen"},
    {"x": 9, "y": 8, "glyph": "🪟", "room": "kitchen"},
    {"x": 3, "y": 8, "glyph": "🍞", "room": "kitchen"},
    {"x": 1, "y": 13, "glyph": "🔪", "room": "kitchen"},
    {"x": 9, "y": 13, "glyph": "🪴", "room": "kitchen"},
    # bathroom
    {"x": 17, "y": 11, "glyph": "🚿", "room": "bath"},
    {"x": 27, "y": 11, "glyph": "🪞", "room": "bath"},
    {"x": 17, "y": 13, "glyph": "🧴", "room": "bath"},
    {"x": 27, "y": 13, "glyph": "🕯️", "room": "bath"},
    # hall
    {"x": 12, "y": 1, "glyph": "🖼️", "room": "hall"},
    {"x": 15, "y": 1, "glyph": "🧥", "room": "hall"},
    {"x": 13, "y": 13, "glyph": "🪴", "room": "hall"},
]


def _merge_items() -> dict[str, str]:
    items: dict[str, str] = {}
    for o in OBJECTS:
        items[f"{o['x']},{o['y']}"] = o["glyph"]
    for d in DECOR:
        items[f"{d['x']},{d['y']}"] = d["glyph"]
    return items


# Merged item lookup for rendering/observation: ITEM["x,y"] → glyph.
ITEM = _merge_items()

# Static world, derived once.
WALL_MAP = compute_wall_map()
WALKABLE = derive_walkable(WALL_MAP)
ROOM_GRID = derive_room_grid(WALL_MAP)
room_at = make_room_at(ROOM_GRID)
