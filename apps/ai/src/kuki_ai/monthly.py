"""Splits a spreadsheet column the model listed as one fact back into its months.

Extraction asks for one fact per cell, but a model sometimes returns a whole
monthly column as a single fact ("January 200823; February ..."). Totals by
month can't use that, so it is split here using the parsed workbook's cells.
This runs at extraction time and again on stored documents, which repairs
facts saved before the split existed.
"""

import calendar
import re

from kuki_ai.grounding import as_number, expand_range, verify
from kuki_ai.schemas import Fact, Locator, Segment

_MONTHS = {
    name.lower(): i
    for i in range(1, 13)
    for name in (calendar.month_name[i], calendar.month_abbr[i])
}
_ISO_MONTH = re.compile(r"^(\d{4})-(\d{2})-\d{2}")
_YEAR = re.compile(r"\b(19|20)\d{2}\b")
_REF_PARTS = re.compile(r"^([A-Z]{1,3})(\d+)$")

# Sheet name -> row number -> that row's cells as (ref, value), left to right.
_Rows = dict[str, dict[int, list[tuple[str, float | str]]]]


def _col_row(ref: str) -> tuple[str, int]:
    """`F14` -> ("F", 14). Refs come from expand_range or the parser, so they're well formed."""
    parts = _REF_PARTS.match(ref)
    assert parts, ref
    return parts[1], int(parts[2])


def _row_month(row: list[float | str], year: int | None) -> tuple[int, int] | None:
    """The (year, month) a sheet row is about, from a month name or date in its cells.

    None when the row names a span instead ("Jan - Mar" on a quarterly row), so a
    quarter's value is never booked to its first month.
    """
    found: tuple[int, int] | None = None
    for value in row:
        if not isinstance(value, str):
            continue
        if iso := _ISO_MONTH.match(value):
            return int(iso[1]), int(iso[2])
        months = {_MONTHS[w] for w in re.split(r"[\s\-/'.,]+", value.lower()) if w in _MONTHS}
        if len(months) > 1:
            return None
        if months and not found:
            named = _YEAR.search(value)
            y = int(named[0]) if named else year
            if y:
                found = (y, months.pop())
    return found


def _render(number: float) -> str:
    return str(int(number)) if number.is_integer() else f"{number:g}"


def _per_cell(fact: Fact, rows: _Rows, segments: list[Segment]) -> list[Fact] | None:
    """One fact per row for a column range listed as a single value; None to keep it."""
    loc = fact.locator
    if fact.origin != "reported" or fact.value_number is not None:
        return None
    if not loc.sheet or not loc.cell_range:
        return None
    sheet = rows.get(loc.sheet)
    refs = expand_range(loc.cell_range)
    if not sheet or len(refs) < 2 or len({_col_row(r)[0] for r in refs}) != 1:
        return None  # only single columns, one row per period
    year = int(fact.period_start[:4]) if fact.period_start else None
    split: list[Fact] = []
    for ref in refs:
        row = sheet.get(_col_row(ref)[1], [])
        value = next((v for r, v in row if r == ref), None)
        number = as_number(value) if value is not None else None
        when = _row_month([v for r, v in row if r != ref], year)
        if number is None or when is None:
            return None  # can't place every row in a month, so leave it as it is
        y, m = when
        text = _render(number)
        locator = Locator(sheet=loc.sheet, cell_range=ref)
        verified, why = verify(segments, locator, text, number)
        split.append(
            fact.model_copy(
                update={
                    "key": f"{fact.key}_{y}_{m:02d}",
                    "label": f"{fact.label}, {calendar.month_abbr[m]} {y}",
                    "series": fact.series or fact.label,
                    "value_text": f"{text} {fact.unit}" if fact.unit else text,
                    "value_number": number,
                    "period_start": f"{y}-{m:02d}-01",
                    "period_end": f"{y}-{m:02d}-{calendar.monthrange(y, m)[1]:02d}",
                    "locator": locator,
                    "quote": text,
                    "verified": verified,
                    "verification": why,
                }
            )
        )
    return split


def split_listed(facts: list[Fact], segments: list[Segment]) -> list[Fact]:
    """`facts` with every listed monthly column replaced by one fact per month."""
    rows: _Rows = {}
    for segment in segments:
        if not segment.cells or not segment.locator.sheet:
            continue
        sheet = rows.setdefault(segment.locator.sheet, {})
        for ref, value in segment.cells.items():
            sheet.setdefault(_col_row(ref)[1], []).append((ref, value))
    if not rows:
        return facts
    out: list[Fact] = []
    for fact in facts:
        out.extend(_per_cell(fact, rows, segments) or [fact])
    return out
