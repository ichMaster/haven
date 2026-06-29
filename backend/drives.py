"""Drives and target selection.

Ported from the v0 prototype (``lili_house_aitown.jsx`` §7–8). Internal keys use
the ARCHITECTURE data-model names (``inspiration``/``calm``/``energy``/``warmth``);
``DRIVE_LABELS`` maps them to the prototype's Ukrainian display labels.
"""

from __future__ import annotations

from .world import OBJECTS

# Drives in display order (ties in `lowest_drive` resolve to this order).
DRIVE_KEYS = ("inspiration", "calm", "energy", "warmth")
DRIVES_INIT = {"inspiration": 78, "calm": 60, "energy": 52, "warmth": 46}
DRIVE_LABELS = {
    "inspiration": "натхнення",
    "calm": "спокій",
    "energy": "енергія",
    "warmth": "тепло",
}

# Tunables.
DECAY = 3  # drop per drive per tick
REFILL = 17  # gain on the active drive per acting tick
ACT_TICKS_MAX = 4  # action ends at this many ticks…
DRIVE_FULL = 94  # …or when the active drive reaches this

# Lowest drive → room that satisfies it.
DRIVE_ROOM = {
    "inspiration": "art",  # studio
    "energy": "sleep",  # bedroom
    "calm": "bath",  # bathroom
    "warmth": "kitchen",  # kitchen
}

# Room being acted in → drive it refills (an office visit satisfies warmth).
ROOM_DRIVE = {
    "art": "inspiration",
    "sleep": "energy",
    "bath": "calm",
    "kitchen": "warmth",
    "office": "warmth",
}


def clamp(value: float, lo: float = 0, hi: float = 100) -> float:
    return max(lo, min(hi, value))


def decay_drives(drives: dict[str, float]) -> dict[str, float]:
    """Decay every drive by DECAY (floored at 0)."""
    return {k: clamp(drives[k] - DECAY) for k in DRIVE_KEYS}


def refill_drive(drives: dict[str, float], key: str) -> dict[str, float]:
    """Refill one drive by REFILL (capped at 100)."""
    return {**drives, key: clamp(drives[key] + REFILL)}


def action_done(act_ticks: int, drive_value: float) -> bool:
    """An action ends once it has run long enough or the drive is essentially full."""
    return act_ticks >= ACT_TICKS_MAX or drive_value >= DRIVE_FULL


def lowest_drive(drives: dict[str, float]) -> str:
    """Lowest drive's key (ties resolve to DRIVE_KEYS order)."""
    low = DRIVE_KEYS[0]
    for k in DRIVE_KEYS:
        if drives[k] < drives[low]:
            low = k
    return low


def pick_target(drives: dict[str, float], user_room: str | None = None) -> dict | None:
    """Pick the OBJECTS target for the lowest drive's room.

    Special case: when the lowest drive is ``warmth`` and the user is in the
    office, the agent comes to you — the target becomes the office object. In v1.1
    there is no player, so ``user_room`` is ``None`` and the override is inert
    (it activates in v1.3).
    """
    low = lowest_drive(drives)
    room = DRIVE_ROOM[low]
    if low == "warmth" and user_room == "office":
        room = "office"
    return next((o for o in OBJECTS if o["room"] == room), None)
