"""HVN-021 — headless tick-loop runner & mock-clock harness."""

import asyncio
import random

from backend.loop import World, run, run_ticks
from backend.sim import MIN_PER_TICK
from backend.world import room_at


def test_run_ticks_advances_clock():
    world = World(rng=random.Random(0))
    run_ticks(world, 10)
    assert world.state["t"] == 8 * 60 + 10 * MIN_PER_TICK


def test_run_ticks_is_deterministic():
    a = run_ticks(World(rng=random.Random(1)), 30)
    b = run_ticks(World(rng=random.Random(1)), 30)
    assert a["t"] == b["t"]
    assert a["lili"] == b["lili"]
    assert a["log"] == b["log"]


def test_world_lives_headless():
    # over many ticks Лілі visits >=2 rooms, acts >=1, and speaks >=1 line —
    # entirely headless (no client, no network, no model call).
    world = World(rng=random.Random(0))
    rooms_visited = set()
    acted = False
    for _ in range(150):
        world.tick()
        s = world.state
        rooms_visited.add(room_at(s["lili"]["x"], s["lili"]["y"]))
        if s["lili"]["acting"]:
            acted = True
    assert len(rooms_visited) >= 2
    assert acted
    assert len(world.state["log"]) >= 1  # she spoke at least one logged line


def test_async_run_stops_after_max_ticks():
    world = asyncio.run(run(world=World(rng=random.Random(0)), tick_ms=1, max_ticks=5, log=False))
    assert world.state["t"] == 8 * 60 + 5 * MIN_PER_TICK
