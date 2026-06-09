"""Server configuration for the Haven backend.

Settings come from the environment, optionally seeded from a gitignored ``.env``
at the repo root. The Anthropic key is held **server-side only** and is unused in
v1.1 (it is wired into chat in v1.4); it is never logged.
"""

from __future__ import annotations

import os
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    """Minimal stdlib ``.env`` loader: ``KEY=VALUE`` lines, ``#`` comments.

    Existing environment variables win (they are never overwritten). Surrounding
    quotes on the value are stripped.
    """
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv(_REPO_ROOT / ".env")

# World tick interval in milliseconds (shared by all protocols).
TICK_MS: int = int(os.environ.get("HAVEN_TICK_MS", "1000"))

# Anthropic API key — server-side only; unused in v1.1 (wired in v1.4). Never log it.
ANTHROPIC_API_KEY: str | None = os.environ.get("ANTHROPIC_API_KEY") or None


def has_api_key() -> bool:
    """Whether an Anthropic key is configured (its value is never exposed)."""
    return bool(ANTHROPIC_API_KEY)
