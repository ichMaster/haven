"""``python -m backend`` entrypoint — runs the headless tick loop (v1.1).

The world lives and ticks with no client; the telnet command server arrives in
v1.2 (see specification/TERMINAL_SERVER_SPEC.md).
"""

from __future__ import annotations

from . import loop

if __name__ == "__main__":
    loop.main()
