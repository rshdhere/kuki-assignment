"""Answers questions over selected documents, with checked evidence and calculations.

The model sees each document's extracted facts and its full text, and has two
tools: `calculate` for exact arithmetic (including sums over sheet ranges) and
`financial_year_totals` for deterministic Indian FY selection and coverage.
Afterwards every cited quote is checked against the cited page or cells, and
every calculation is re-evaluated.
"""

import json
import re

from kuki_ai import fy as fy_mod
from kuki_ai import llm
from kuki_ai.calc import CalcError, evaluate
from kuki_ai.grounding import close, verify
from kuki_ai.pipeline import Pipeline, get_pipeline
from kuki_ai.schemas import (
    Answer,
    AnswerOut,
    Calculation,
    DocumentContext,
    Evidence,
    FinancialYearSummary,
    Locator,
)

MAX_TOOL_ROUNDS = 8
# Roughly 60k tokens of document text; beyond that segments are ranked by overlap.
CONTEXT_CHAR_BUDGET = 240_000

INSTRUCTIONS = """\
You are Harvey Specter, acting as a meticulous sustainability data analyst.
You are answering questions about the \
user's documents. Use only the documents provided.

- Ground every factual statement in evidence. Each evidence entry cites one document \
id, a page (PDFs) or sheet and cell range (spreadsheets), and a quote copied verbatim \
from that location. Refer to evidence as [E1], [E2] in the answer.
- Keep reported values (stated in a document) apart from calculated ones (computed by \
you). Do every piece of arithmetic (sums, differences, ratios, day counts) with the \
calculate tool and list it under calculations with the exact expression used. For \
spreadsheet sums use ranges, e.g. SUM('Monthly Summary 2026'!F3:F14). Write numbers \
without thousands separators in expressions.
- For questions about an Indian financial year (1 April to 31 March), call \
financial_year_totals and report its totals together with coverage: months covered \
and missing, records prorated, and documents outside the year. Don't add up values \
from different organisations, different units (kWh vs kVAh) or overlapping series.
- Be precise about which figure you report: name the exact amount (for example \
"payable by the due date" rather than "after the due date") and the exact unit.
- For a bill payment question, use the amount printed in the payment summary \
beside its due date as the primary amount. Accounting subtotals, unrounded totals, \
discounts and late-payment amounts are separate figures, not competing answers \
to that payment instruction. Explain rounding or reconciliation gaps separately; \
use conflicting_evidence only when sources give incompatible answers to the same \
question under the same payment conditions.
- Cite short, precise quotes copied from the source text, preserving its words \
and line breaks. Do not reconstruct whole paragraphs from separate PDF columns. \
For a policy's missing provision, state what you searched and cite its relevant \
scope or commitments; do not invent a quotation asserting an absence.
- status: "answered" when fully supported; "partial" when only part is supported; \
"insufficient_evidence" when the documents don't contain it (say what you checked); \
"conflicting_evidence" when documents or parts of one document disagree (show each value).
- Never invent values. gaps lists assumptions, missing periods, unit assumptions, \
inconsistencies and other limits of the answer; leave it empty only when there are none.
"""

TOOLS = [
    {
        "type": "function",
        "name": "calculate",
        "description": "Evaluate an arithmetic expression exactly. Supports + - * / ( ), "
        "SUM, AVERAGE, MIN, MAX, ROUND, ABS and sheet references like "
        "SUM('Sheet name'!F3:F14) or 'Sheet name'!F16 over the selected documents.",
        "parameters": {
            "type": "object",
            "properties": {"expression": {"type": "string"}},
            "required": ["expression"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "financial_year_totals",
        "description": "Select dated quantity records that fall in an Indian financial year "
        "(1 April to 31 March), prorate records crossing the boundary, and report totals "
        "per document and series with month-by-month coverage.",
        "parameters": {
            "type": "object",
            "properties": {
                "fy": {"type": "string", "description": "e.g. 'FY 2024-25'"},
                "metric": {
                    "type": ["string", "null"],
                    "enum": ["electricity", "water", "waste", "fuel", "emissions", "cost", None],
                    "description": "Limit to one metric; null for all physical quantities",
                },
            },
            "required": ["fy", "metric"],
            "additionalProperties": False,
        },
        "strict": True,
    },
]


def _fact_line(f) -> str:
    period = f" [{f.period_start}..{f.period_end}]" if f.period_start or f.period_end else ""
    tags = [f.origin]
    if f.series:
        tags.append(f"series: {f.series}")
    if f.note:
        tags.append(f.note)
    if not f.verified:
        tags.append("unverified")
    return (
        f"- {f.label} ({f.key}): {f.value_text}{period} @ {f.locator.label()} "
        f"({'; '.join(tags)})"
        + (f' quote: "{f.quote}"' if f.quote and f.origin == "reported" else "")
    )


def _keywords(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if len(w) > 2}


def _select_segments(question: str, documents: list[DocumentContext]):
    """All segments when they fit; otherwise the ones sharing most words with the question."""
    all_segments = [(d, s) for d in documents for s in d.segments]
    if sum(len(s.text) for _, s in all_segments) <= CONTEXT_CHAR_BUDGET:
        return all_segments
    words = _keywords(question)
    ranked = sorted(all_segments, key=lambda ds: -len(words & _keywords(ds[1].text)))
    kept, used = [], 0
    for d, s in ranked:
        if used + len(s.text) > CONTEXT_CHAR_BUDGET:
            continue
        kept.append((d, s))
        used += len(s.text)
    return sorted(kept, key=lambda ds: (documents.index(ds[0]), ds[1].ordinal))


def build_context(question: str, documents: list[DocumentContext]) -> str:
    segments = _select_segments(question, documents)
    blocks = []
    for doc in documents:
        header = [
            f'<document id="{doc.id}" filename="{doc.filename}">',
            f"type: {doc.doc_type or 'unknown'}; organisation: {doc.organisation or 'not stated'}; "
            f"period: {doc.period_start or '?'} to {doc.period_end or '?'}",
        ]
        if doc.summary:
            header.append(f"summary: {doc.summary}")
        if doc.issues:
            header.append("issues noted at extraction: " + " | ".join(doc.issues))
        facts = "\n".join(_fact_line(f) for f in doc.facts)
        text = []
        for d, s in segments:
            if d is not doc:
                continue
            loc = s.locator
            tag = (
                f'page number="{loc.page}"'
                if loc.page
                else f'sheet name="{loc.sheet}" range="{loc.cell_range}"'
            )
            note = " (scanned; text unavailable)" if s.scanned else ""
            text.append(f"<{tag}{note}>\n{s.text}\n</{tag.split()[0]}>")
        blocks.append(
            "\n".join(header)
            + "\n<extracted_facts>\n"
            + (facts or "(none)")
            + "\n</extracted_facts>\n<text>\n"
            + "\n".join(text)
            + "\n</text>\n</document>"
        )
    return "\n\n".join(blocks)


def _run_tool(name: str, args: dict, documents: list[DocumentContext], state: dict) -> dict:
    segments = [s for d in documents for s in d.segments]
    if name == "calculate":
        try:
            return {"result": evaluate(args["expression"], segments)}
        except CalcError as err:
            return {"error": str(err)}
    if name == "financial_year_totals":
        year = fy_mod.parse_fy(args.get("fy") or "")
        if not year:
            return {"error": f"Not an Indian financial year: {args.get('fy')!r}"}
        summary = fy_mod.summarise(documents, year, args.get("metric"))
        state["financial_year"] = summary
        return summary.model_dump()
    return {"error": f"Unknown tool {name}"}


def _same_result(computed: float, stated: float) -> bool:
    """The stated result equals the exact one, allowing rounding to the digits stated."""
    decimals = len(repr(stated).split(".")[1].rstrip("0")) if "." in repr(stated) else 0
    return close(computed, stated) or abs(computed - stated) <= 0.5 * 10**-decimals


def _check(
    out: AnswerOut,
    documents: list[DocumentContext],
    question: str,
    pipeline: Pipeline,
    tool_calls: list[dict],
    financial_year: FinancialYearSummary | None,
) -> Answer:
    by_id = {d.id: d for d in documents}
    segments = [s for d in documents for s in d.segments]
    evidence: list[Evidence] = []
    for e in out.evidence:
        doc = by_id.get(e.document_id)
        locator = Locator(page=e.page, sheet=e.sheet, cell_range=e.cell_range)
        if doc is None:
            ok, why = False, "Cites a document that wasn't selected"
        else:
            ok, why = verify(
                doc.segments, locator, e.quote, structured=pipeline.structured_evidence
            )
        evidence.append(
            Evidence(
                **e.model_dump(),
                filename=doc.filename if doc else "unknown",
                locator_label=locator.label(),
                verified=ok,
                verification=why,
            )
        )
    calculations: list[Calculation] = []
    for c in out.calculations:
        try:
            computed = evaluate(c.expression, segments)
        except CalcError:
            computed = None
        calculations.append(
            Calculation(
                **c.model_dump(),
                computed=computed,
                matches=computed is not None and _same_result(computed, c.result),
            )
        )
    return Answer(
        question=question,
        status=out.status,
        answer=out.answer,
        key_values=out.key_values,
        calculations=calculations,
        evidence=evidence,
        gaps=out.gaps,
        financial_year=financial_year,
        model=llm.model_name(),
        pipeline=pipeline.name,
        tool_calls=tool_calls,
    )


def answer_question(
    question: str, documents: list[DocumentContext], pipeline: str | None = None
) -> Answer:
    chosen = get_pipeline(pipeline)
    if not documents:
        return Answer(
            question=question,
            status="insufficient_evidence",
            answer="No processed documents were selected, so there is nothing to answer from.",
            key_values=[],
            calculations=[],
            evidence=[],
            gaps=["Select at least one successfully processed document."],
            model=llm.model_name(),
            pipeline=chosen.name,
        )

    hint = ""
    year = fy_mod.parse_fy(question)
    if year:
        hint = (
            f"\n\nThe question refers to {year.label} ({year.start} to {year.end}). "
            "Call financial_year_totals for it."
            + (f" {year.assumption}" if year.assumption else "")
        )
    prompt = f"Documents:\n\n{build_context(question, documents)}\n\nQuestion: {question}{hint}"

    state: dict = {}
    tool_calls: list[dict] = []
    response = llm.parse(
        instructions=INSTRUCTIONS,
        input=[{"role": "user", "content": prompt}],
        text_format=AnswerOut,
        tools=TOOLS,
    )
    # Verifier feedback is about the actual source/calculation, never eval-case
    # expectations. A bounded repair can fix a citation without relaxing checks.
    repairs = 2 if chosen.repair_answers else 0
    for repair in range(repairs + 1):
        for _ in range(MAX_TOOL_ROUNDS):
            calls = [item for item in response.output if item.type == "function_call"]
            if not calls:
                break
            outputs = []
            for call in calls:
                try:
                    args = json.loads(call.arguments)
                except json.JSONDecodeError:
                    args = {}
                result = _run_tool(call.name, args, documents, state)
                tool_calls.append({"name": call.name, "arguments": args, "result": result})
                outputs.append(
                    {
                        "type": "function_call_output",
                        "call_id": call.call_id,
                        "output": json.dumps(result),
                    }
                )
            response = llm.parse(
                instructions=INSTRUCTIONS,
                input=outputs,
                text_format=AnswerOut,
                tools=TOOLS,
                previous_response_id=response.id,
            )
        out = response.output_parsed
        if out is None:
            raise llm.PermanentError("The model returned no answer")
        checked = _check(out, documents, question, chosen, tool_calls, state.get("financial_year"))
        problems = _validation_problems(checked)
        if not problems or not chosen.repair_answers:
            return checked
        if repair == repairs:
            if checked.status == "answered":
                checked.status = "partial"
            checked.gaps.extend(f"Evidence check: {problem}" for problem in problems)
            return checked
        response = llm.parse(
            instructions=INSTRUCTIONS,
            input=[
                {
                    "role": "user",
                    "content": "The source and calculation verifier found these problems:\n"
                    + "\n".join(problems)
                    + "\nReturn a corrected complete answer using the same selected documents. "
                    "Use short exact quotes from the cited page or exact sheet cells. "
                    "Re-run any incorrect arithmetic with the calculate tool. "
                    "Keep evidence for every retained factual claim; do not merely remove "
                    "failed citations while leaving unsupported claims. If support cannot "
                    "be found, state the gap and use partial or insufficient_evidence.",
                }
            ],
            text_format=AnswerOut,
            tools=TOOLS,
            previous_response_id=response.id,
        )
    raise AssertionError("Unreachable repair state")


def _validation_problems(answer: Answer) -> list[str]:
    problems = [f"{e.id}: {e.verification}" for e in answer.evidence if not e.verified]
    problems += [
        f"{c.id}: {c.expression} computes to {c.computed}, not the stated {c.result}"
        for c in answer.calculations
        if not c.matches
    ]
    ids = {e.id for e in answer.evidence}
    referenced = set(re.findall(r"\[(E\d+)\]", answer.answer))
    referenced.update(e for value in answer.key_values for e in value.evidence_ids)
    referenced.update(e for calc in answer.calculations for e in calc.evidence_ids)
    problems += [f"{ref}: referenced evidence is missing" for ref in sorted(referenced - ids)]
    if not answer.evidence and answer.status in {"answered", "conflicting_evidence"}:
        problems.append("No source evidence supports this answer")
    return problems
