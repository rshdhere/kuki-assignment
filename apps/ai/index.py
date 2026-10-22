"""ASGI entry point for the deployed AI service."""

import sys
from pathlib import Path

# Vercel installs dependencies without installing this src-layout package.
sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from kuki_ai.app import app  # noqa: E402

__all__ = ["app"]
