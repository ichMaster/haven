"""HVN-020 — per-tick decision loop & world clock (advance)."""

import random

from backend.sim import (
    DAY_MIN,
    LOG_LEN,
    MIN_PER_TICK,
    VOICE,
    advance,
    fmt_time,
    initial_sim,
)
from backend.world import OBJECTS, WALKABLE, room_at

_obj = {o["room"]: o for o in OBJECTS}


def _step(state, seed=0, user_room=None):
    return advance(
        state, walkable=WALKABLE, room_at=room_at, rng=random.Random(seed), user_room=user_room
    )


def test_clock_advance_and_day_roll():
    assert MIN_PER_TICK == 9
    s1 = _step(initial_sim())
    assert s1["t"] == 8 * 60 + 9
    rolled = _step({**initial_sim(), "t": DAY_MIN - 3, "day": 2})
    assert rolled["day"] == 3
    assert rolled["t"] == MIN_PER_TICK - 3  # (1437 + 9) - 1440


def test_decay_each_tick():
    s = _step(initial_sim())  # first tick just picks a target — no refill
    assert s["drives"] == {"inspiration": 75, "calm": 57, "energy": 49, "warmth": 43}


def test_pick_target_when_idle():
    # init lowest drive is warmth → kitchen (no player → warmth→office inert)
    s = _step(initial_sim())
    assert s["target"]["room"] == "kitchen"
    assert "йде до" in s["action"]


def test_step_toward_target():
    start = {
        **initial_sim(),
        "lili": {"x": 5, "y": 3, "acting": False, "act_ticks": 0},
        "target": _obj["bath"],
    }
    s = _step(start)
    moved = abs(s["lili"]["x"] - 5) + abs(s["lili"]["y"] - 3)
    assert moved == 1
    assert WALKABLE[s["lili"]["y"]][s["lili"]["x"]] is True
    assert "йде до" in s["action"]


def test_arrival_begins_acting_with_room_line():
    o = _obj["kitchen"]
    on_target = {
        **initial_sim(),
        "lili": {"x": o["x"], "y": o["y"], "acting": False, "act_ticks": 0},
        "target": o,
    }
    s = _step(on_target)
    assert s["lili"]["acting"] is True
    assert s["lili"]["act_ticks"] == 0
    assert s["voice"] in VOICE["kitchen"]
    assert s["log"][-1]["line"] == s["voice"]


def test_acting_refills_and_ends_at_threshold():
    o = _obj["sleep"]  # refills energy
    s = {
        **initial_sim(),
        "lili": {"x": o["x"], "y": o["y"], "acting": True, "act_ticks": 0},
        "target": o,
        "drives": {"inspiration": 80, "calm": 80, "energy": 50, "warmth": 80},
    }
    before = s["drives"]["energy"]
    s = _step(s)
    assert s["drives"]["energy"] == before + 14  # +17 refill, -3 decay
    assert s["lili"]["act_ticks"] == 1
    guard = 0
    while s["lili"]["acting"] and guard < 10:
        s = _step(s)
        guard += 1
    assert s["lili"]["acting"] is False
    assert s["target"] is None


def test_log_keeps_last_five():
    s = initial_sim()
    for _ in range(60):
        s = _step(s)
    assert len(s["log"]) <= LOG_LEN
    for e in s["log"]:
        assert isinstance(e["t"], int)
        assert isinstance(e["line"], str)
        assert e["line"] not in VOICE["you"]  # `you` asides never logged


def test_fmt_time():
    assert fmt_time(8 * 60) == "08:00"
    assert fmt_time(0) == "00:00"
    assert fmt_time(13 * 60 + 5) == "13:05"


def test_headless_with_you_inert():
    # no player (user_room None) → never "з тобою поруч", never a `you` line
    s = initial_sim()
    for _ in range(80):
        s = _step(s)
        assert "з тобою поруч" not in s["action"]
        assert s["voice"] not in VOICE["you"] or s["voice"] == ""
