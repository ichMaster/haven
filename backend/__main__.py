"""``python -m backend`` entrypoint.

In v1.1 this prints a startup banner; the headless tick-loop runner is wired in
HVN-021 (``backend/loop.py``).
"""

from __future__ import annotations

from . import __version__, config


def main() -> None:
    print(
        f"Haven backend v{__version__} — headless world. "
        f"tick={config.TICK_MS}ms · key={'set' if config.has_api_key() else 'absent'}."
    )
    print("Tick loop arrives in HVN-021; nothing to run yet.")


if __name__ == "__main__":
    main()
