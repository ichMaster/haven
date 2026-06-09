"""HVN-018 — drives & target selection (pick_target)."""

from backend.drives import (
    DECAY,
    DRIVE_LABELS,
    DRIVES_INIT,
    REFILL,
    action_done,
    clamp,
    decay_drives,
    lowest_drive,
    pick_target,
    refill_drive,
)


def test_initial_drives():
    assert DRIVES_INIT == {"inspiration": 78, "calm": 60, "energy": 52, "warmth": 46}
    assert DRIVE_LABELS["warmth"] == "тепло"


def test_clamp():
    assert clamp(-5) == 0
    assert clamp(150) == 100
    assert clamp(42) == 42


def test_decay_floor():
    assert DECAY == 3
    d = decay_drives({"inspiration": 50, "calm": 2, "energy": 3, "warmth": 0})
    assert d == {"inspiration": 47, "calm": 0, "energy": 0, "warmth": 0}


def test_refill_cap():
    assert REFILL == 17
    assert refill_drive({"warmth": 46}, "warmth")["warmth"] == 63
    assert refill_drive({"warmth": 90}, "warmth")["warmth"] == 100


def test_action_done_thresholds():
    assert action_done(4, 10) is True
    assert action_done(5, 10) is True
    assert action_done(2, 94) is True
    assert action_done(2, 93) is False
    assert action_done(0, 0) is False


def test_lowest_drive():
    assert lowest_drive({"inspiration": 78, "calm": 60, "energy": 52, "warmth": 46}) == "warmth"
    low_insp = {"inspiration": 10, "calm": 60, "energy": 52, "warmth": 46}
    assert lowest_drive(low_insp) == "inspiration"


def _low(key):
    d = {"inspiration": 80, "calm": 80, "energy": 80, "warmth": 80}
    d[key] = 5
    return d


def test_pick_target_mapping():
    assert pick_target(_low("inspiration"))["room"] == "art"
    assert pick_target(_low("energy"))["room"] == "sleep"
    assert pick_target(_low("calm"))["room"] == "bath"
    assert pick_target(_low("warmth"))["room"] == "kitchen"


def test_warmth_office_override_and_inertness():
    warm = _low("warmth")
    assert pick_target(warm, "office")["room"] == "office"  # comes to you
    assert pick_target(warm, "kitchen")["room"] == "kitchen"  # not in office → normal
    assert pick_target(warm, None)["room"] == "kitchen"  # v1.1: no player → inert
    # the override only fires when warmth is the lowest drive
    assert pick_target(_low("inspiration"), "office")["room"] == "art"
