"""Per-tick decision loop and world clock.

Ported from the v0 prototype (``lili_house_aitown.jsx`` §10–11). ``advance`` is a
pure reducer: given the current state and world deps, it returns the next state.
Deterministic for a fixed ``rng`` (a ``random.Random``-like object with
``.random()``) so the tick is fully testable.

v1.1 is single-agent (Лілі) and headless — there is **no player**, so
``user_room`` is ``None``: ``with_you`` is always False and the warmth→office /
``you``-pool branches are inert (they activate in v1.3).
"""

from __future__ import annotations

import random
from typing import Any

from .drives import DRIVES_INIT, ROOM_DRIVE, action_done, decay_drives, pick_target, refill_drive
from .nav import bfs_next
from .world import ROOMS

TICK_MS_DEFAULT = 850  # prototype pace (the server re-tunes via config.TICK_MS)
MIN_PER_TICK = 9  # world minutes advanced per tick
DAY_MIN = 1440  # minutes in a day
LOG_LEN = 5  # event-log length

# Fixed in-character Ukrainian line pools per acting room, plus `you` (lines for
# when the user is near) and a `hall` placeholder. Model-generated only from v3.1.
VOICE = {
    "art": [
        "Тут народжується щось нове…",
        "Колір лягає сам собою.",
        "Ще один мазок — і відпущу.",
    ],
    "sleep": ["Трохи перепочину…", "Очі злипаються.", "Подрімаю хвилинку."],
    "kitchen": ["Заварю собі чаю.", "Пахне теплом і домом.", "Щось смачненьке…"],
    "bath": ["Тепла вода — це спокій.", "Змиваю втому дня.", "Ще хвильку тиші."],
    "office": ["Влаштувалася в кабінеті.", "Тепле світло лампи, тиша.", "Гортаю книжку при лампі."],
    "you": ["Я рада, що ти поруч.", "Сумувала за тобою.", "Добре, що ти тут."],
    "hall": "…",
}

_DEFAULT_RNG = random.Random()


def _pick(pool: list[str], rng: random.Random) -> str:
    return pool[int(rng.random() * len(pool))]


def fmt_time(t: int) -> str:
    """Format minutes-into-day as HH:MM (24h)."""
    m = ((t % DAY_MIN) + DAY_MIN) % DAY_MIN
    return f"{m // 60:02d}:{m % 60:02d}"


def initial_sim() -> dict[str, Any]:
    """Seed the single-agent world: Лілі in her studio, the clock at 08:00."""
    return {
        "t": 8 * 60,
        "day": 1,
        "drives": dict(DRIVES_INIT),
        "lili": {"x": 5, "y": 3, "acting": False, "act_ticks": 0},
        "target": None,  # the OBJECTS entry Лілі is heading to / acting on
        "action": "",
        "voice": "",  # current spoken line ("" or "…" hidden)
        "log": [],  # last LOG_LEN events: {t, day, line}
    }


def advance(
    state: dict[str, Any],
    *,
    walkable: list[list[bool]],
    room_at,
    rng: random.Random | None = None,
    user_room: str | None = None,
) -> dict[str, Any]:
    """One tick: clock → decay → act/move/pick-target → voice. Returns next state.

    ``user_room`` is the player's room (``None`` in v1.1 → ``with_you`` always
    False, warmth→office inert).
    """
    rng = rng or _DEFAULT_RNG

    # 1. clock
    t = state["t"] + MIN_PER_TICK
    day = state["day"]
    if t >= DAY_MIN:
        t -= DAY_MIN
        day += 1

    # 2. decay every drive
    drives = decay_drives(state["drives"])

    # 3. where is Лілі, and is the user with her?
    lili = dict(state["lili"])
    target = dict(state["target"]) if state["target"] else None
    here = room_at(lili["x"], lili["y"])
    with_you = here == user_room  # None → always False in v1.1
    action = state["action"]
    voice = state["voice"]
    new_line = None  # ambient activity line → spoken AND logged
    bubble_line = None  # conversational aside to the user → spoken only (not logged)

    if lili["acting"] and target:
        # 4. acting: refill the target drive, maybe acknowledge the user, then end
        lili["act_ticks"] += 1
        drive_key = ROOM_DRIVE[target["room"]]
        drives = refill_drive(drives, drive_key)
        r = ROOMS[target["room"]]
        action = f"{r['verb']} ({r['name']})"
        if with_you:
            if rng.random() < 0.5:
                action = f"{r['verb']}, з тобою поруч"
            if rng.random() < 0.6:
                bubble_line = _pick(VOICE["you"], rng)
        if action_done(lili["act_ticks"], drives[drive_key]):
            lili["acting"] = False
            lili["act_ticks"] = 0
            target = None
    elif target:
        # 5. has a target: act on arrival, else step one cell toward it
        if (lili["x"], lili["y"]) == (target["x"], target["y"]):
            lili["acting"] = True
            lili["act_ticks"] = 0
            r = ROOMS[target["room"]]
            action = f"{r['verb']} ({r['name']})"
            new_line = _pick(VOICE[target["room"]], rng)
        else:
            nx, ny = bfs_next((lili["x"], lili["y"]), (target["x"], target["y"]), walkable)
            lili["x"], lili["y"] = nx, ny
            action = f"йде до: {ROOMS[target['room']]['name']}"
    else:
        # 6. no target: choose the room of the lowest drive
        target = pick_target(drives, user_room)
        if target:
            action = f"йде до: {ROOMS[target['room']]['name']}"

    # 7. ambient lines update the spoken line AND the rolling log; a conversational
    # aside updates only the spoken line (not logged).
    log = state["log"]
    if new_line and new_line != "…":
        voice = new_line
        log = [*state["log"], {"t": t, "day": day, "line": new_line}][-LOG_LEN:]
    elif bubble_line and bubble_line != "…":
        voice = bubble_line

    return {
        **state,
        "t": t,
        "day": day,
        "drives": drives,
        "lili": lili,
        "target": target,
        "action": action,
        "voice": voice,
        "log": log,
    }
