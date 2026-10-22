"""Settings read from the environment (and `apps/ai/.env` when present)."""

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

APP_DIR = Path(__file__).resolve().parents[2]
load_dotenv(APP_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    openai_model: str = field(default_factory=lambda: os.getenv("OPENAI_MODEL", "gpt-5.5"))
    # Only sent when set, since non-reasoning models reject the parameter.
    reasoning_effort: str | None = field(
        default_factory=lambda: os.getenv("OPENAI_REASONING_EFFORT") or None
    )
    openai_timeout_s: float = field(
        default_factory=lambda: float(os.getenv("OPENAI_TIMEOUT_S", "180"))
    )
    # The SDK retries 429s, 5xx and connection errors with exponential backoff.
    openai_max_retries: int = field(
        default_factory=lambda: int(os.getenv("OPENAI_MAX_RETRIES", "3"))
    )
    aws_region: str = field(default_factory=lambda: os.getenv("AWS_REGION", "ap-south-1"))
    # Pages with less extractable text than this are treated as scans and sent as images.
    min_page_chars: int = 40
    image_dpi: int = 144


settings = Settings()
