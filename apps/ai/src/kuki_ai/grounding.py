"""Checks that quotes and values really appear where they are cited."""

import re
import unicodedata

from openpyxl.utils import column_index_from_string, get_column_letter

from kuki_ai.schemas import Locator, Segment

_NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")
_REF = re.compile(r"^([A-Z]{1,3})(\d+)$")


def normalize(text: str) -> str:
    """Lowercase, NFKC, unified dashes and quotes, no whitespace."""
    text = unicodedata.normalize("NFKC", text).lower()
    text = re.sub(r"[‐-―−]", "-", text)
    text = re.sub(r"[‘’`]", "'", text).replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", "", text)


def numbers_in(text: str) -> list[float]:
    out = []
    for match in _NUMBER.findall(text):
        try:
            out.append(float(match.replace(",", "")))
        except ValueError:
            continue
    return out


def close(a: float, b: float) -> bool:
    # Printed amounts and cell values are exact, so allow rounding only below a paisa.
    return abs(a - b) <= 0.005


def expand_range(cell_range: str) -> list[str]:
    """`F3:F14` -> [F3, ..., F14]; `B2` -> [B2]."""
    parts = cell_range.replace("$", "").upper().split(":")
    if len(parts) == 1:
        return parts if _REF.match(parts[0]) else []
    a, b = (_REF.match(p) for p in parts[:2])
    if not a or not b:
        return []
    c1, c2 = sorted((column_index_from_string(a[1]), column_index_from_string(b[1])))
    r1, r2 = sorted((int(a[2]), int(b[2])))
    return [f"{get_column_letter(c)}{r}" for r in range(r1, r2 + 1) for c in range(c1, c2 + 1)]


def find_segments(segments: list[Segment], locator: Locator) -> list[Segment]:
    """Segments that hold the located page, or the located cells."""
    if locator.page is not None:
        return [s for s in segments if s.locator.page == locator.page]
    if locator.sheet:
        sheet = [s for s in segments if s.locator.sheet == locator.sheet and s.cells is not None]
        if not locator.cell_range:
            return sheet
        refs = set(expand_range(locator.cell_range))
        return [s for s in sheet if refs & set(s.cells or {})]
    return []


def cell_values(segments: list[Segment], sheet: str, cell_range: str) -> list[float | str]:
    refs = expand_range(cell_range)
    values: dict[str, float | str] = {}
    for segment in segments:
        if segment.locator.sheet == sheet and segment.cells:
            values.update(segment.cells)
    return [values[r] for r in refs if r in values]


_CELL_TOKEN = re.compile(r"(?<![A-Za-z])([A-Z]{1,3}\d+)=(.*?)(?=\s*(?:\||\.\.\.|…|\n|$))")


def as_number(value: float | str) -> float | None:
    """Cell values as numbers, including numbers stored as text ("1533290", "34.0%")."""
    if isinstance(value, float):
        return value
    text = value.strip().replace(",", "").removesuffix("%").strip()
    try:
        return float(text)
    except ValueError:
        return None


def _same_cell_value(quoted: str, actual: float | str) -> bool:
    a, q = as_number(actual), as_number(quoted)
    if a is not None and q is not None:
        return close(q, a)
    return normalize(quoted) == normalize(str(actual))


def _verify_cell_quote(
    segments: list[Segment], locator: Locator, quote: str
) -> tuple[bool, str] | None:
    """Checks quotes written as `REF=value` cells, each against the real cell.

    Returns None when the quote isn't in that form. Every quoted cell must be
    inside the cited range and hold the quoted value.
    """
    tokens = _CELL_TOKEN.findall(quote)
    if not tokens:
        return None
    allowed = set(expand_range(locator.cell_range or ""))
    cells: dict[str, float | str] = {}
    for segment in segments:
        if segment.locator.sheet == locator.sheet and segment.cells:
            cells.update(segment.cells)
    for ref, quoted in tokens:
        if ref not in allowed:
            return False, f"{ref} is outside {locator.label()}"
        if ref not in cells:
            return False, f"{locator.sheet}!{ref} is empty"
        if not _same_cell_value(quoted, cells[ref]):
            return False, f"{locator.sheet}!{ref} holds {cells[ref]}, not {quoted}"
    return True, f"All {len(tokens)} quoted cells match {locator.label()}"


def _verify_quote_lines(text: str, quote: str) -> bool:
    """Every line of a multi-line quote appears on the page.

    Two-column layouts interleave columns line by line in the extracted text,
    so a quote copied from one column is never contiguous, but each of its
    lines is. Lines under three words are too generic to count on their own.
    """
    lines = [line for line in quote.splitlines() if line.strip()]
    if len(lines) < 2:
        return False
    page = normalize(text)
    substantial = [line for line in lines if len(line.split()) >= 3]
    return bool(substantial) and all(normalize(line) in page for line in lines)


def verify(
    segments: list[Segment],
    locator: Locator,
    quote: str | None,
    value: float | None = None,
    *,
    structured: bool = False,
) -> tuple[bool, str]:
    """Returns (verified, explanation) for a quote and/or value at a location.

    `structured` turns on cell-aware and layout-aware matching (the improved
    pipeline): `REF=value` quotes are checked cell by cell, numbers stored as
    text are compared as numbers, signs are ignored when matching page
    numbers, and multi-line quotes from multi-column pages are matched line by
    line.
    """
    found = find_segments(segments, locator)
    if not found:
        return False, f"No {locator.label()} in this document"
    if any(s.scanned for s in found):
        return False, f"{locator.label()} is a scanned page; read from the image, not checkable"

    if locator.sheet and locator.cell_range:
        values = cell_values(segments, locator.sheet, locator.cell_range)
        if not values:
            return False, f"{locator.label()} is empty"
        numbers = [v for v in values if isinstance(v, float)]
        if structured:
            numbers = [n for n in (as_number(v) for v in values) if n is not None]
            if quote and (cell_check := _verify_cell_quote(segments, locator, quote)):
                ok, why = cell_check
                if not ok or value is None or any(close(n, value) for n in numbers):
                    return ok, why
        if value is not None:
            if any(close(n, value) for n in numbers):
                return True, f"Value found in {locator.label()}"
            return False, f"{locator.label()} holds {_short(values)}, not {value:g}"
        if quote and any(normalize(quote) in normalize(str(v)) for v in values):
            return True, f"Quote matches {locator.label()}"
        quoted_numbers = numbers_in(quote or "")
        if quoted_numbers and all(any(close(q, n) for n in numbers) for q in quoted_numbers):
            return True, f"Numbers in quote match {locator.label()}"
        return False, f"Quote not found in {locator.label()}"

    text = "\n".join(s.text for s in found)
    page_numbers = numbers_in(text)
    if structured and value is not None:
        value = abs(value)  # "-8,777.32" reads as 8777.32 on the page
    if quote:
        if normalize(quote) in normalize(text):
            if (
                value is None
                or any(close(n, value) for n in numbers_in(quote))
                or any(close(n, value) for n in page_numbers)
            ):
                return True, f"Quote found on {locator.label()}"
            return False, f"Quote found on {locator.label()} but the value {value:g} is not"
        if structured and _verify_quote_lines(text, quote):
            if value is None or any(close(n, value) for n in page_numbers):
                return True, f"Quote found line by line on {locator.label()} (multi-column layout)"
        quoted = numbers_in(quote)
        if quoted and all(any(close(q, n) for n in page_numbers) for q in quoted):
            return True, f"Quote paraphrased; its numbers appear on {locator.label()}"
    if value is not None and any(close(n, value) for n in page_numbers):
        return True, f"Value appears on {locator.label()} (quote not verbatim)"
    return False, f"Quote not found on {locator.label()}"


def _short(values: list) -> str:
    shown = ", ".join(str(v) for v in values[:4])
    return shown + ("…" if len(values) > 4 else "")
