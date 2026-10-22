"""Classifies a document and extracts facts tied to their page or cell range."""

import base64
from datetime import date

from kuki_ai import llm
from kuki_ai.grounding import verify
from kuki_ai.parsing import ParsedDocument, parse_document
from kuki_ai.pipeline import Pipeline, get_pipeline
from kuki_ai.schemas import Extraction, ExtractionOut, Fact, Locator

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
the same series name on every row and the row's period; and every total, subtotal or \
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
    for f in out.facts:
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
