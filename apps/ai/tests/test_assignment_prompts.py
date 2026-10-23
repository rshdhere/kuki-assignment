"""Explicit assignment requirement for every classification/extraction/QA prompt."""

import pytest

from kuki_ai.extraction import INSTRUCTIONS as EXTRACTION_INSTRUCTIONS
from kuki_ai.qa import INSTRUCTIONS as QA_INSTRUCTIONS

REQUIRED = "You are Harvey Specter, acting as a meticulous sustainability data analyst."


@pytest.mark.parametrize(
    "instructions",
    [EXTRACTION_INSTRUCTIONS, QA_INSTRUCTIONS],
    ids=["classification-extraction", "qa"],
)
def test_assignment_required_sentence(instructions):
    assert REQUIRED in instructions
