"""Named pipeline variants, so evals can compare versions on the same cases."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Pipeline:
    name: str
    # Send every PDF page as an image next to its text, not only scanned pages.
    page_images: bool = False
    # Check evidence cell by cell for spreadsheets and line by line for
    # multi-column pages, instead of as one exact string (see grounding.verify).
    structured_evidence: bool = False
    # Give the model deterministic verifier feedback before publishing an answer.
    repair_answers: bool = False


PIPELINES = {
    "baseline": Pipeline("baseline"),
    # Structured verification plus bounded feedback repairs for bad citations
    # or calculations. Baseline keeps the original one-pass answering behavior.
    "improved": Pipeline("improved", structured_evidence=True, repair_answers=True),
}

DEFAULT_PIPELINE = "improved"


def get_pipeline(name: str | None) -> Pipeline:
    try:
        return PIPELINES[name or DEFAULT_PIPELINE]
    except KeyError:
        raise ValueError(f"Unknown pipeline {name!r}; choose from {sorted(PIPELINES)}") from None
