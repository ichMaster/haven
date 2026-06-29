"""Headless tick-loop runner (v1.1).

Advances the single shared world on a fixed interval with no client — proving
"the world ticks without a browser". ``World`` holds the state; ``run_ticks`` is
the mock-clock harness that drives deterministic ticks without real time.
"""

from __future__ import annotations

import asyncio
import random
import signal
from typing import Any

from . import config
from .sim import advance, fmt_time, initial_sim
from .world import WALKABLE, room_at


class World:
    """Holds the simulation state and advances it one tick at a time."""

    def __init__(self, *, rng: random.Random | None = None, state: dict[str, Any] | None = None):
        self.state = state if state is not None else initial_sim()
        self.rng = rng or random.Random()

    def tick(self) -> dict[str, Any]:
        # v1.1 is headless: no player, so user_room stays None.
        self.state = advance(self.state, walkable=WALKABLE, room_at=room_at, rng=self.rng)
        return self.state


def run_ticks(world: World, n: int) -> dict[str, Any]:
    """Mock clock: advance the world ``n`` ticks synchronously (no real time)."""
    for _ in range(n):
        world.tick()
    return world.state


def _log_line(state: dict[str, Any], prev_voice: str) -> str:
    name = state["agent"]["name"]
    line = f"День {state['day']} · {fmt_time(state['t'])} · {name} {state['action'] or '…'}"
    voice = state["voice"]
    if voice and voice != "…" and voice != prev_voice:
        line += f"   [{name}]: {voice}"
    return line


async def run(
    *,
    tick_ms: int | None = None,
    world: World | None = None,
    log: bool = True,
    max_ticks: int | None = None,
) -> World:
    """Run the tick loop until SIGINT/SIGTERM (or ``max_ticks`` for tests)."""
    world = world or World()
    interval = (tick_ms if tick_ms is not None else config.TICK_MS) / 1000
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop.set)
        except (NotImplementedError, RuntimeError):
            pass  # signal handlers unavailable (e.g. non-main thread / Windows)

    prev_voice = ""
    ticks = 0
    while not stop.is_set():
        world.tick()
        ticks += 1
        if log:
            print(_log_line(world.state, prev_voice))
        prev_voice = world.state["voice"]
        if max_ticks is not None and ticks >= max_ticks:
            break
        try:
            await asyncio.wait_for(stop.wait(), timeout=interval)
        except TimeoutError:
            pass  # next tick
    return world


def main() -> None:
    print(
        f"Haven backend — headless world ticking every {config.TICK_MS}ms "
        f"(key {'set' if config.has_api_key() else 'absent'}). Ctrl+C to stop."
    )
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        pass
    print("\nЗупинено.")
