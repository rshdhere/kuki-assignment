"""The question-answering loop and the eval scoring, with the model stubbed out."""

from types import SimpleNamespace

from fastapi.testclient import TestClient

from kuki_ai import llm, qa
from kuki_ai.app import app
from kuki_ai.evals.scoring import score_case, summarise_scores
from kuki_ai.parsing import parse_document
from kuki_ai.schemas import AnswerOut, DocumentContext


def _doc(bill_pdf) -> DocumentContext:
    return DocumentContext(
        id="doc1",
        filename="bill.pdf",
        organisation="Acme",
        segments=parse_document(bill_pdf, "bill.pdf").segments,
    )


def _final(**overrides) -> AnswerOut:
    data = {
        "status": "answered",
        "answer": "47407 kWh were consumed in April 2024 [E1].",
        "key_values": [
            {
                "label": "Units consumed",
                "value": 47407,
                "value_text": "47,407 kWh",
                "unit": "kWh",
                "period": "2024-04-01 to 2024-04-30",
                "origin": "reported",
                "evidence_ids": ["E1"],
                "calculation_id": None,
            }
        ],
        "calculations": [
            {
                "id": "C1",
                "description": "Average per day",
                "expression": "47407 / 30",
                "result": 1580.23,
                "unit": "kWh/day",
                "evidence_ids": ["E1"],
            }
        ],
        "evidence": [
            {
                "id": "E1",
                "document_id": "doc1",
                "page": 1,
                "sheet": None,
                "cell_range": None,
                "quote": "Units Consumed 47407",
            },
            {
                "id": "E2",
                "document_id": "doc1",
                "page": 1,
                "sheet": None,
                "cell_range": None,
                "quote": "Made-up line",
            },
        ],
        "gaps": [],
    }
    data.update(overrides)
    return AnswerOut.model_validate(data)


def test_tool_loop_runs_calculations_and_checks_evidence(bill_pdf, monkeypatch):
    calls = []

    def fake_parse(**kwargs):
        calls.append(kwargs)
        if len(calls) == 1:
            tool_call = SimpleNamespace(
                type="function_call",
                name="calculate",
                arguments='{"expression": "47407 / 30"}',
                call_id="c1",
            )
            return SimpleNamespace(id="r1", output=[tool_call], output_parsed=None)
        return SimpleNamespace(id="r2", output=[], output_parsed=_final())

    monkeypatch.setattr(llm, "parse", fake_parse)
    answer = qa.answer_question("How much electricity in April?", [_doc(bill_pdf)])

    assert calls[1]["previous_response_id"] == "r1"
    assert calls[1]["input"][0]["type"] == "function_call_output"
    assert answer.tool_calls[0]["result"]["result"] == 47407 / 30
    assert [e.verified for e in answer.evidence] == [True, False]
    [calc] = answer.calculations
    assert calc.matches and abs(calc.computed - 1580.2333) < 1e-3


def test_fy_question_gets_hint_and_summary(bill_pdf, monkeypatch):
    prompts = []

    def fake_parse(**kwargs):
        prompts.append(kwargs["input"])
        if len(prompts) == 1:
            call = SimpleNamespace(
                type="function_call",
                name="financial_year_totals",
                arguments='{"fy": "FY 2024-25", "metric": "electricity"}',
                call_id="c1",
            )
            return SimpleNamespace(id="r1", output=[call], output_parsed=None)
        return SimpleNamespace(id="r2", output=[], output_parsed=_final(status="partial"))

    monkeypatch.setattr(llm, "parse", fake_parse)
    answer = qa.answer_question("Total electricity in FY 2024-25?", [_doc(bill_pdf)])
    assert "FY 2024-25 (2024-04-01 to 2025-03-31)" in prompts[0][0]["content"]
    assert answer.financial_year and answer.financial_year.fy == "FY 2024-25"


def test_no_documents_is_insufficient_evidence():
    answer = qa.answer_question("Anything?", [])
    assert answer.status == "insufficient_evidence"


def test_failed_citations_are_repaired_using_verifier_feedback(bill_pdf, monkeypatch):
    calls = []

    def fake_parse(**kwargs):
        calls.append(kwargs)
        out = _final() if len(calls) == 1 else _final(evidence=_final().evidence[:1])
        return SimpleNamespace(id=f"r{len(calls)}", output=[], output_parsed=out)

    monkeypatch.setattr(llm, "parse", fake_parse)
    answer = qa.answer_question("How much electricity?", [_doc(bill_pdf)], "improved")

    assert len(calls) == 2
    assert calls[1]["previous_response_id"] == "r1"
    assert "E2" in calls[1]["input"][0]["content"]
    assert "Quote not found" in calls[1]["input"][0]["content"]
    assert answer.evidence and all(e.verified for e in answer.evidence)


def test_unrepaired_evidence_is_not_published_as_fully_answered(bill_pdf, monkeypatch):
    calls = []

    def fake_parse(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(id=f"r{len(calls)}", output=[], output_parsed=_final())

    monkeypatch.setattr(llm, "parse", fake_parse)
    answer = qa.answer_question("How much electricity?", [_doc(bill_pdf)], "improved")

    assert len(calls) == 3
    assert answer.status == "partial"
    assert any("E2" in gap and "not found" in gap for gap in answer.gaps)
    assert not answer.evidence[1].verified


def test_scoring_marks(bill_pdf, monkeypatch):
    monkeypatch.setattr(
        llm,
        "parse",
        lambda **_: SimpleNamespace(
            id="r", output=[], output_parsed=_final(evidence=_final().evidence[:1])
        ),
    )
    answer = qa.answer_question("q", [_doc(bill_pdf)])
    ids = {"doc1": "bill.pdf"}
    good = {
        "expect": {
            "status": ["answered"],
            "values": [{"value": 47407}],
            "primary": 47407,
            "mentions": [["2024-04-01", "01-04-2024"]],
            "sources": [{"document": "bill.pdf", "page": 1}],
            "calculation": [1580.23],
        }
    }
    score = score_case(good, answer, ids)
    assert score["mark"] == "pass", score["notes"]

    wrong_primary = {"expect": {**good["expect"], "primary": 631510}}
    assert score_case(wrong_primary, answer, ids)["mark"] == "fail"

    needs_gaps = {"expect": {**good["expect"], "gaps": True}}
    partial = score_case(needs_gaps, answer, ids)
    assert partial["mark"] == "partial" and partial["checks"]["uncertainty"] is False

    forbidden = {"expect": {"forbidden": [{"value": 47407, "unit": "kWh"}]}}
    assert score_case(forbidden, answer, ids)["mark"] == "fail"

    summary = summarise_scores([{"score": score}, {"score": partial}])
    assert summary["score"] == 0.75 and summary["checks"]["uncertainty"]["applicable"] == 1


def test_financial_year_endpoint():
    client = TestClient(app)
    body = {
        "fy": "2024-25",
        "documents": [
            {
                "id": "a",
                "filename": "a.pdf",
                "organisation": "Acme",
                "facts": [
                    {
                        "key": "u",
                        "label": "Units",
                        "category": "consumption",
                        "metric": "electricity",
                        "value_text": "100 kWh",
                        "value_number": 100,
                        "unit": "kWh",
                        "period_start": "2024-04-01",
                        "period_end": "2024-04-30",
                        "locator": {"page": 1},
                    }
                ],
            }
        ],
    }
    res = client.post("/financial-year", json=body)
    assert res.status_code == 200
    assert res.json()["groups"][0]["total"] == 100
    assert client.post("/financial-year", json={**body, "fy": "soon"}).status_code == 400


def test_errors_map_to_retryable_status(monkeypatch):
    def boom(*_a, **_k):
        raise llm.TransientError("rate limited")

    monkeypatch.setattr("kuki_ai.app.answer_question", boom)
    res = TestClient(app).post("/ask", json={"question": "q", "documents": []})
    assert res.status_code == 503 and res.json()["retryable"] is True


def test_calculation_results_may_be_rounded_but_not_wrong():
    assert qa._same_result(1580.2333, 1580.23)
    assert qa._same_result(1580.2333, 1580.2)
    assert qa._same_result(1580.2333, 1580.0)
    assert qa._same_result(1580.2333, 1581.0) is False
    assert qa._same_result(2426123.0, 2426123.0)
    assert qa._same_result(2426123.0, 2425123.0) is False


def test_primary_skips_non_numeric_key_values_and_sources_accept_page_lists(bill_pdf, monkeypatch):
    first_is_a_date = (
        _final()
        .key_values[0]
        .model_copy(update={"label": "Due date", "value": None, "value_text": "30-05-2024"})
    )
    out = _final(
        key_values=[first_is_a_date.model_dump(), _final().key_values[0].model_dump()],
        evidence=_final().evidence[:1],
    )
    monkeypatch.setattr(
        llm, "parse", lambda **_: SimpleNamespace(id="r", output=[], output_parsed=out)
    )
    answer = qa.answer_question("q", [_doc(bill_pdf)])
    case = {"expect": {"primary": 47407, "sources": [{"document": "bill.pdf", "page": [2, 1]}]}}
    assert score_case(case, answer, {"doc1": "bill.pdf"})["mark"] == "pass"
