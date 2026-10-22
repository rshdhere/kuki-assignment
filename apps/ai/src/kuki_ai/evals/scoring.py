"""Scores one answer against one eval case.

Four checks, each applicable or not depending on the case:
- answer: status allowed, expected values present, the primary figure first,
  no forbidden figures presented as key values, required mentions present
- evidence: every expected location is cited by verified evidence, and at
  least 80% of all cited evidence verifies against the documents
- calculation: a calculation the system re-evaluated produces an expected value
- uncertainty: gaps or limits are stated when the case calls for it
A case passes when every applicable check passes, is partial when the answer
check passes but another doesn't, and fails otherwise.
"""

from typing import Any

from kuki_ai.grounding import close, expand_range, normalize, numbers_in
from kuki_ai.schemas import Answer

EVIDENCE_PRECISION = 0.8


def _near(a: float, b: float, tolerance: float | None) -> bool:
    return abs(a - b) <= (tolerance if tolerance is not None else max(abs(b) * 0.005, 0.005))


def _answer_text(answer: Answer) -> str:
    parts = [answer.answer, *answer.gaps]
    parts += [
        f"{kv.label} {kv.value_text} {kv.unit or ''} {kv.period or ''}" for kv in answer.key_values
    ]
    parts += [f"{c.description} {c.expression}" for c in answer.calculations]
    return "\n".join(parts)


def _pages(page: int | list[int]) -> list[int]:
    """A source may name one page or every page that states the value."""
    return page if isinstance(page, list) else [page]


def _ranges_overlap(a: str | None, b: str | None) -> bool:
    if not a or not b:
        return True
    return bool(set(expand_range(a)) & set(expand_range(b)))


def score_case(case: dict, answer: Answer, filename_by_id: dict[str, str]) -> dict[str, Any]:
    expect = case.get("expect", {})
    text = _answer_text(answer)
    norm_text = normalize(text)
    text_numbers = numbers_in(text)
    kv_numbers = [kv.value for kv in answer.key_values if kv.value is not None]
    notes: list[str] = []
    checks: dict[str, bool | None] = {}

    # --- answer -----------------------------------------------------------
    ok = True
    if "status" in expect and answer.status not in expect["status"]:
        ok = False
        notes.append(f"status {answer.status}, expected one of {expect['status']}")
    for v in expect.get("values", []):
        target, tol = float(v["value"]), v.get("tolerance")
        if not any(_near(n, target, tol) for n in kv_numbers + text_numbers):
            ok = False
            notes.append(f"missing value {target:g}")
    if "primary" in expect:
        # The first figure given; dates and other non-numeric key values don't count.
        first = next((kv.value for kv in answer.key_values if kv.value is not None), None)
        if first is None or not _near(first, float(expect["primary"]), None):
            ok = False
            notes.append(f"first key value is {first}, expected {expect['primary']}")
    for f in expect.get("forbidden", []):
        for kv in answer.key_values:
            unit_hit = "unit" not in f or normalize(kv.unit or "") == normalize(f["unit"])
            if kv.value is not None and close(kv.value, float(f["value"])) and unit_hit:
                ok = False
                notes.append(f"presents forbidden value {f['value']} as '{kv.label}'")
    for group in expect.get("mentions", []):
        if not any(normalize(alt) in norm_text for alt in group):
            ok = False
            notes.append(f"mentions none of {group[:3]}…")
    checks["answer"] = ok

    # --- evidence ---------------------------------------------------------
    verified = [e for e in answer.evidence if e.verified]
    precision = len(verified) / len(answer.evidence) if answer.evidence else 1.0
    missing_sources = []
    for src in expect.get("sources", []):
        hit = any(
            filename_by_id.get(e.document_id) == src["document"]
            and (src.get("page") is None or e.page in _pages(src["page"]))
            and (src.get("sheet") is None or e.sheet == src["sheet"])
            and _ranges_overlap(e.cell_range, src.get("cell_range"))
            for e in verified
        )
        if not hit:
            missing_sources.append(src)
    if missing_sources:
        notes.append(
            "no verified evidence at "
            + ", ".join(
                f"{s['document']} "
                + (
                    f"p.{s['page']}"
                    if s.get("page")
                    else f"{s.get('sheet')}!{s.get('cell_range') or ''}"
                )
                for s in missing_sources
            )
        )
    if precision < EVIDENCE_PRECISION:
        notes.append(f"only {len(verified)}/{len(answer.evidence)} evidence quotes verified")
    checks["evidence"] = not missing_sources and precision >= EVIDENCE_PRECISION

    # --- calculation ------------------------------------------------------
    if "calculation" in expect:
        good = [c for c in answer.calculations if c.matches and c.computed is not None]
        hit = any(_near(c.computed, float(t), None) for c in good for t in expect["calculation"])
        if not hit:
            notes.append(
                "no checked calculation gives "
                + " or ".join(f"{t:g}" for t in expect["calculation"])
                + (
                    f" ({len(answer.calculations) - len(good)} did not re-evaluate)"
                    if len(good) < len(answer.calculations)
                    else ""
                )
            )
        checks["calculation"] = hit
    else:
        checks["calculation"] = None

    # --- uncertainty ------------------------------------------------------
    if expect.get("gaps"):
        checks["uncertainty"] = bool(answer.gaps)
        if not answer.gaps:
            notes.append("no gaps or limitations stated")
    else:
        checks["uncertainty"] = None

    applicable = [v for v in checks.values() if v is not None]
    if all(applicable):
        mark = "pass"
    elif checks["answer"]:
        mark = "partial"
    else:
        mark = "fail"
    return {
        "mark": mark,
        "checks": checks,
        "notes": notes,
        "evidence_precision": round(precision, 3),
    }


def summarise_scores(results: list[dict]) -> dict[str, Any]:
    marks = [r["score"]["mark"] for r in results]
    by_check: dict[str, dict[str, int]] = {}
    for r in results:
        for name, value in r["score"]["checks"].items():
            if value is None:
                continue
            entry = by_check.setdefault(name, {"passed": 0, "applicable": 0})
            entry["applicable"] += 1
            entry["passed"] += int(value)
    return {
        "cases": len(results),
        "pass": marks.count("pass"),
        "partial": marks.count("partial"),
        "fail": marks.count("fail"),
        "error": marks.count("error"),
        # pass = 1, partial = 0.5
        "score": round(
            (marks.count("pass") + 0.5 * marks.count("partial")) / max(len(results), 1), 3
        ),
        "checks": {
            k: {**v, "rate": round(v["passed"] / v["applicable"], 3)} for k, v in by_check.items()
        },
    }
