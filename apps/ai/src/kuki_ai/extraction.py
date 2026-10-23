"""Classifies a document and extracts facts tied to their page or cell range."""

import base64
import calendar
import re
from datetime import date

from kuki_ai import llm
from kuki_ai.grounding import as_number, expand_range, verify
from kuki_ai.parsing import ParsedDocument, parse_document
from kuki_ai.pipeline import Pipeline, get_pipeline
from kuki_ai.schemas import Extraction, ExtractionOut, Fact, FactOut, Locator, Segment

INSTRUCTIONS = """\
You are a meticulous sustainability data analyst. You read one business document \
(a utility bill, a consumption spreadsheet, a waste record, a policy, or similar) and \
extract the facts a sustainability reporting team needs, each tied to its exact location.

Rules:
- Extract only what the document states. Never compute, total or infer values; the \
system calculates derived values separately and keeps them apart from reported ones.
- Every fact needs a source: the 1-based page number for PDFs, or the sheet name and \
cell or range for spreadsheets, plus a quote copied verbatim from that location that \
contains the value. For a spreadsheet cell, quote the cell's value.
- Keep different amounts apart. Bills often print several: current month charges, \
arrears or previous outstanding, rebates, the amount payable by the due date, the \
amount with a prompt-payment discount, the amount after the due date, taxes. Extract \
each as its own fact with a precise key and label, with its due date in the note.
- Keep units exactly as printed (kWh vs kVAh vs kVA, KL vs m3). If no unit is printed \
next to a value, give the most likely unit and say "unit not printed; assumed" in note.
- Dates are YYYY-MM-DD. Indian documents write dates day first (DD-MM-YYYY, DD.MM.YYYY).
- Give period_start and period_end for any value that covers a period (billing \
period, month, quarter, year). A meter reading or dated entry uses its date for both.
- metric: electricity, water, waste, fuel or emissions for physical quantities, cost \
for money. category: consumption for a quantity used over a period, meter_reading for \
readings, amount for money, quantity for other measured amounts such as waste weights.

What to extract, by document type:
- Bills: customer and organisation, account or consumer number, bill number and date, \
billing period, previous and current meter readings with dates, multiplying factor, \
consumption for every unit printed, contract demand, the main charges and taxes, and \
every payable amount with its due date.
- Spreadsheets: every value of every series (each monthly value in each column), with \
the same series name on every row and the row's period. One fact per cell: never put a \
column's values into one fact as a list. Also every total, subtotal or \
summary cell as its own fact whose key contains "total". If totals and their parts \
look inconsistent, say so in issues without computing a corrected value.
- Records and forms: every entry with its date, quantity, unit and description; who \
filed or signed it and when.
- Policies: issuer, scope (who and what it covers), each commitment, any targets, time \
limits or deadlines, the effective or signature date and signatory. Never invent an \
element that is absent.
- issues: contradictions, illegible or missing parts, missing units, dates that don't \
fit together, anything a reviewer should double-check. Write each one in plain \
language for a non-technical reader, one sentence, about the document itself; don't \
mention OCR, text extraction, parsing or how you read the file.
"""


def _content(parsed: ParsedDocument) -> list[dict]:
    parts: list[dict] = [
        {
            "type": "input_text",
            "text": f"File: {parsed.filename} ({parsed.kind}"
            + (f", {parsed.page_count} pages)" if parsed.page_count else ")"),
        }
    ]
    for segment in parsed.segments:
        loc = segment.locator
        if loc.page is not None:
            body = segment.text or "(no text layer)"
            if segment.scanned:
                body += f"\n(scanned page: read page {loc.page} from its image below)"
            parts.append(
                {"type": "input_text", "text": f'<page number="{loc.page}">\n{body}\n</page>'}
            )
        else:
            parts.append(
                {
                    "type": "input_text",
                    "text": f'<sheet name="{loc.sheet}" range="{loc.cell_range}">\n'
                    f"{segment.text}\n</sheet>",
                }
            )
    for page, png in sorted(parsed.page_images.items()):
        parts.append({"type": "input_text", "text": f"Image of page {page}:"})
        parts.append(
            {
                "type": "input_image",
                "image_url": "data:image/png;base64," + base64.b64encode(png).decode(),
                "detail": "high",
            }
        )
    return parts


def _days(start: str | None, end: str | None) -> int | None:
    try:
        return (date.fromisoformat(end) - date.fromisoformat(start)).days + 1  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


_MONTHS = {
    name.lower(): i
    for i in range(1, 13)
    for name in (calendar.month_name[i], calendar.month_abbr[i])
}
_ISO_MONTH = re.compile(r"^(\d{4})-(\d{2})-\d{2}")
_YEAR = re.compile(r"\b(19|20)\d{2}\b")
_REF_PARTS = re.compile(r"^([A-Z]{1,3})(\d+)$")


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


def _col_row(ref: str) -> tuple[str, int]:
    """`F14` -> ("F", 14). Refs come from expand_range or the parser, so they're well formed."""
    parts = _REF_PARTS.match(ref)
    assert parts, ref
    return parts[1], int(parts[2])


def _render(number: float) -> str:
    return str(int(number)) if number.is_integer() else f"{number:g}"


# Sheet name -> row number -> that row's cells as (ref, value), left to right.
_Rows = dict[str, dict[int, list[tuple[str, float | str]]]]


def _per_cell(fact: FactOut, rows: _Rows) -> list[FactOut] | None:
    """One fact per row for a column range the model returned as a single listed value."""
    source = fact.source
    if fact.value_number is not None or not source.sheet or not source.cell_range:
        return None
    sheet = rows.get(source.sheet)
    refs = expand_range(source.cell_range)
    if not sheet or len(refs) < 2 or len({_col_row(r)[0] for r in refs}) != 1:
        return None  # only single columns, one row per period
    year = int(fact.period_start[:4]) if fact.period_start else None
    split: list[FactOut] = []
    for ref in refs:
        row = sheet.get(_col_row(ref)[1], [])
        value = next((v for r, v in row if r == ref), None)
        number = as_number(value) if value is not None else None
        when = _row_month([v for r, v in row if r != ref], year)
        if number is None or when is None:
            return None  # can't place every row in a month, so leave it as the model gave it
        y, m = when
        text = _render(number)
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
                    "source": source.model_copy(update={"cell_range": ref, "quote": text}),
                }
            )
        )
    return split


def _split_ranges(facts: list[FactOut], segments: list[Segment]) -> list[FactOut]:
    """Models sometimes list a whole monthly column as one fact; split it into its months."""
    rows: _Rows = {}
    for segment in segments:
        if not segment.cells or not segment.locator.sheet:
            continue
        sheet = rows.setdefault(segment.locator.sheet, {})
        for ref, value in segment.cells.items():
            sheet.setdefault(_col_row(ref)[1], []).append((ref, value))
    out: list[FactOut] = []
    for fact in facts:
        out.extend(_per_cell(fact, rows) or [fact])
    return out


def _calculated_facts(doc_type: str, facts: list[Fact]) -> list[Fact]:
    """Derived values a reviewer expects next to a bill, marked as calculated."""
    if not doc_type.endswith("_bill"):
        return []
    out: list[Fact] = []
    for fact in facts:
        days = _days(fact.period_start, fact.period_end)
        if fact.category != "consumption" or fact.value_number is None or not days:
            continue
        per_day = fact.value_number / days
        out.append(
            Fact(
                key=f"{fact.key}_per_day",
                label=f"{fact.label} per day",
                category="consumption",
                metric=fact.metric,
                value_text=f"{per_day:,.2f} {fact.unit or ''}".strip(),
                value_number=round(per_day, 4),
                unit=f"{fact.unit}/day" if fact.unit else None,
                period_start=fact.period_start,
                period_end=fact.period_end,
                origin="calculated",
                locator=fact.locator,
                verified=fact.verified,
                verification="Derived from a reported value",
                derivation=f"{fact.value_number:g} ÷ {days} days "
                f"({fact.period_start} to {fact.period_end}, inclusive)",
            )
        )
    return out


def extract_parsed(parsed: ParsedDocument, pipeline: Pipeline) -> Extraction:
    response = llm.parse(
        instructions=INSTRUCTIONS,
        input=[{"role": "user", "content": _content(parsed)}],
        text_format=ExtractionOut,
    )
    out = response.output_parsed
    if out is None:
        raise llm.PermanentError("The model returned no extraction")

    facts: list[Fact] = []
    for f in _split_ranges(out.facts, parsed.segments):
        locator = Locator(page=f.source.page, sheet=f.source.sheet, cell_range=f.source.cell_range)
        verified, why = verify(
            parsed.segments,
            locator,
            f.source.quote,
            f.value_number,
            structured=pipeline.structured_evidence,
        )
        facts.append(
            Fact(
                **f.model_dump(exclude={"source"}),
                locator=locator,
                quote=f.source.quote,
                verified=verified,
                verification=why,
            )
        )
    facts.extend(_calculated_facts(out.doc_type, facts))

    return Extraction(
        doc_type=out.doc_type,
        title=out.title,
        organisation=out.organisation,
        issuer=out.issuer,
        period_start=out.period_start,
        period_end=out.period_end,
        summary=out.summary,
        page_count=parsed.page_count,
        facts=facts,
        issues=out.issues,
        segments=parsed.segments,
        model=llm.model_name(),
        pipeline=pipeline.name,
    )


def extract_document(
    data: bytes, filename: str, content_type: str | None = None, pipeline: str | None = None
) -> Extraction:
    chosen = get_pipeline(pipeline)
    parsed = parse_document(data, filename, content_type, all_page_images=chosen.page_images)
    return extract_parsed(parsed, chosen)
