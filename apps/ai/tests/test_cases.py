"""The eval cases file loads and every expectation is well formed."""

import yaml

from kuki_ai.evals.run import EVALS_DIR

CHECK_KEYS = {
    "status",
    "values",
    "primary",
    "forbidden",
    "mentions",
    "sources",
    "calculation",
    "gaps",
}
STATUSES = {"answered", "partial", "insufficient_evidence", "conflicting_evidence"}


def test_cases_are_well_formed():
    cases = yaml.safe_load((EVALS_DIR / "cases.yaml").read_text())
    assert len(cases) >= 10
    assert len({c["id"] for c in cases}) == len(cases)
    for case in cases:
        assert case["question"] and case["documents"] and case["source"], case["id"]
        expect = case["expect"]
        assert set(expect) <= CHECK_KEYS, case["id"]
        assert set(expect.get("status", [])) <= STATUSES, case["id"]
        for v in expect.get("values", []):
            float(v["value"])
        for group in expect.get("mentions", []):
            assert isinstance(group, list) and group, case["id"]
        for src in expect.get("sources", []):
            assert src["document"] in case["documents"], case["id"]
            assert "page" in src or "sheet" in src, case["id"]
