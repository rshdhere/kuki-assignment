"""OpenAI calls with structured outputs, and the error split the worker relies on.

Transient failures (rate limits, timeouts, 5xx, connection errors) surface as
`TransientError` after the SDK's own retries, so the queue retries the job
later. Requests the API rejects outright surface as `PermanentError`.
"""

from functools import cache
from typing import Any

import openai
from openai import OpenAI
from pydantic import BaseModel

from kuki_ai.config import settings


class TransientError(Exception):
    """Worth retrying later."""


class PermanentError(Exception):
    """Retrying the same input won't help."""


@cache
def _client() -> OpenAI:
    return OpenAI(timeout=settings.openai_timeout_s, max_retries=settings.openai_max_retries)


def client() -> OpenAI:
    try:
        return _client()
    except openai.OpenAIError as err:  # no API key configured
        raise TransientError(f"OpenAI client not configured: {err}") from err


def _options() -> dict[str, Any]:
    options: dict[str, Any] = {"model": settings.openai_model}
    if settings.reasoning_effort:
        options["reasoning"] = {"effort": settings.reasoning_effort}
    return options


def parse[T: BaseModel](
    *,
    instructions: str,
    input: list[dict] | str,
    text_format: type[T],
    tools: list[dict] | None = None,
    previous_response_id: str | None = None,
    max_output_tokens: int = 32_000,
):
    """One Responses API call. Returns the parsed response (may hold tool calls)."""
    try:
        response = client().responses.parse(
            instructions=instructions,
            input=input,
            text_format=text_format,
            tools=tools or openai.omit,
            previous_response_id=previous_response_id or openai.omit,
            max_output_tokens=max_output_tokens,
            **_options(),
        )
    except (
        openai.RateLimitError,
        openai.APITimeoutError,
        openai.APIConnectionError,
        openai.InternalServerError,
        # A missing or revoked key is fixed by configuration, not by giving up.
        openai.AuthenticationError,
    ) as err:
        raise TransientError(f"OpenAI: {type(err).__name__}: {err}") from err
    except openai.APIStatusError as err:
        if err.status_code in (408, 409, 429) or err.status_code >= 500:
            raise TransientError(f"OpenAI {err.status_code}: {err}") from err
        raise PermanentError(f"OpenAI {err.status_code}: {err}") from err
    except openai.LengthFinishReasonError as err:
        raise PermanentError("The model ran out of output tokens") from err
    if response.status == "incomplete":
        reason = response.incomplete_details.reason if response.incomplete_details else "unknown"
        raise PermanentError(f"Incomplete response: {reason}")
    return response


def model_name() -> str:
    return settings.openai_model
