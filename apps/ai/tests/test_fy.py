from datetime import date

from kuki_ai.fy import FinancialYear, parse_fy, summarise
from kuki_ai.schemas import DocumentContext, Fact, Locator


def fact(
    key, value, start, end, *, metric="electricity", unit="kWh", series=None, category="consumption"
):
    return Fact(
        key=key,
        label=key,
        category=category,
        metric=metric,
        series=series,
        value_text=str(value),
        value_number=value,
        unit=unit,
        period_start=start,
        period_end=end,
        locator=Locator(page=1),
        verified=True,
    )


def test_parse_fy_forms():
    assert parse_fy("total in FY 2024-25?").start_year == 2024
    assert parse_fy("2026-2027 totals").start_year == 2026
    assert parse_fy("FY 2024/25").start_year == 2024
    fy25 = parse_fy("what about FY25")
    assert fy25.start_year == 2024 and fy25.assumption
    assert parse_fy("FY 2025").start_year == 2024
    assert parse_fy("in 2024 and 2026") is None
    year = FinancialYear(2024)
    assert (year.label, str(year.start), str(year.end), year.days) == (
        "FY 2024-25",
        "2024-04-01",
        "2025-03-31",
        365,
    )


def test_monthly_rows_win_over_annual_total_and_coverage_is_reported():
    months = [
        ("2026-01-01", "2026-01-31", 10),
        ("2026-04-01", "2026-04-30", 100),
        ("2026-05-01", "2026-05-31", 200),
        ("2026-12-01", "2026-12-31", 300),
    ]
    facts = [fact(f"m{i}", v, s, e, series="Total") for i, (s, e, v) in enumerate(months)]
    facts.append(fact("annual_total", 9999, "2026-01-01", "2026-12-31", series="Total"))
    doc = DocumentContext(id="d1", filename="book.xlsx", facts=facts)
    summary = summarise([doc], FinancialYear(2026), "electricity", today=date(2026, 10, 22))
    [group] = summary.groups
    assert group.total == 600
    assert any("hadn't ended" in n for n in summary.notes)
    assert group.months_covered == ["Apr", "May", "Dec"]
    assert "Jan" in group.months_missing
    assert any("annual_total" in n and "left out" in n for n in summary.notes)
    assert summary.combined is None


def test_boundary_records_are_prorated():
    doc = DocumentContext(
        id="d1",
        filename="bill.pdf",
        organisation="Acme",
        facts=[fact("units", 3100, "2025-03-01", "2025-04-30")],
    )
    [group] = summarise([doc], FinancialYear(2025)).groups
    [record] = group.records
    assert record.prorated and record.overlap_days == 30 and record.period_days == 61
    assert group.total == round(3100 * 30 / 61, 4)


def test_different_organisations_are_not_combined():
    adani = DocumentContext(
        id="a",
        filename="adani.pdf",
        organisation="J Kumar",
        facts=[fact("u", 47407, "2024-04-01", "2024-04-30")],
    )
    bescom = DocumentContext(
        id="b",
        filename="bescom.pdf",
        organisation="Prestige",
        facts=[fact("u", 63000, "2024-06-01", "2024-07-01")],
    )
    water = DocumentContext(id="w", filename="water.pdf", facts=[])
    summary = summarise([adani, bescom, water], FinancialYear(2024), "electricity")
    assert [g.total for g in summary.groups] == [47407, 63000]
    assert summary.combined is None
    assert any("different" in n for n in summary.notes)
    assert summary.documents_without_overlap == ["water.pdf"]


def test_same_organisation_bills_combine_and_units_stay_apart():
    a = DocumentContext(
        id="a",
        filename="apr.pdf",
        organisation="Acme",
        facts=[
            fact("u", 100, "2024-04-01", "2024-04-30"),
            fact("kvah", 110, "2024-04-01", "2024-04-30", unit="kVAh"),
        ],
    )
    b = DocumentContext(
        id="b",
        filename="may.pdf",
        organisation="ACME ",
        facts=[fact("u", 50, "2024-05-01", "2024-05-31")],
    )
    summary = summarise([a, b], FinancialYear(2024), "electricity")
    assert summary.combined == {"electricity (kWh)": 150, "electricity (kVAh)": 110}


def test_costs_are_only_totalled_when_asked_and_per_amount_type():
    doc = DocumentContext(
        id="a",
        filename="bill.pdf",
        organisation="Acme",
        facts=[
            fact(
                "payable_by_due_date",
                631510,
                "2024-04-01",
                "2024-04-30",
                metric="cost",
                unit="INR",
                category="amount",
            ),
            fact(
                "payable_after_due_date",
                639410,
                "2024-04-01",
                "2024-04-30",
                metric="cost",
                unit="INR",
                category="amount",
            ),
        ],
    )
    assert summarise([doc], FinancialYear(2024)).groups == []
    groups = summarise([doc], FinancialYear(2024), "cost").groups
    assert sorted(g.total for g in groups) == [631510, 639410]


def test_only_additive_reported_amounts_are_totalled():
    facts = [
        fact("net_consumption", 63000, "2024-06-01", "2024-06-30", unit="KWH"),
        fact("per_day", 2100, "2024-06-01", "2024-06-30", unit="kWh/day"),
        fact("contract_demand", 750, "2024-06-01", "2024-06-30", unit="kVA"),
        fact("renewable_share", 38.4, "2024-06-01", "2024-06-30", unit="%"),
        fact("highest_month_total", 226100, "2024-06-01", "2024-06-30"),
        fact("present_reading", 639.25, "2024-06-01", "2024-06-30"),
    ]
    facts[1] = facts[1].model_copy(update={"origin": "calculated"})
    doc = DocumentContext(id="b", filename="bescom.pdf", organisation="P", facts=facts)
    [group] = summarise([doc], FinancialYear(2024), "electricity").groups
    assert group.total == 63000 and group.unit == "KWH"


def test_annual_records_crossing_the_boundary_are_not_prorated():
    facts = [
        fact(f"m{m}", 100, f"2026-{m:02d}-01", f"2026-{m:02d}-28", series="Total")
        for m in range(4, 13)
    ] + [fact("annual", 9999, "2026-01-01", "2026-12-31", series="Quarterly annual")]
    doc = DocumentContext(id="w", filename="book.xlsx", facts=facts)
    summary = summarise([doc], FinancialYear(2026), "electricity")
    assert [g.series for g in summary.groups] == ["Total"]
    assert summary.groups[0].total == 900


def test_figures_without_a_series_are_never_interchangeable():
    doc = DocumentContext(
        id="b",
        filename="bescom.pdf",
        organisation="P",
        facts=[
            fact("wheeling_energy", 0, "2024-06-01", "2024-06-30"),
            fact("net_consumption", 63000, "2024-06-01", "2024-06-30"),
        ],
    )
    groups = summarise([doc], FinancialYear(2024), "electricity").groups
    assert sorted(g.total for g in groups) == [0, 63000]


def test_separate_entries_on_the_same_day_all_count():
    loads = [
        ("etp_sludge", 1.0),
        ("waste_powder", 0.5),
        ("phosphate_sludge", 0.5),
        ("oily_residue", 0.4),
    ]
    doc = DocumentContext(
        id="f",
        filename="form3.pdf",
        organisation="TMTE",
        facts=[
            fact(
                k,
                v,
                "2023-03-10",
                "2023-03-10",
                metric="waste",
                unit="T",
                series="Waste quantity",
                category="quantity",
            )
            for k, v in loads
        ],
    )
    [group] = summarise([doc], FinancialYear(2022), "waste").groups
    assert round(group.total, 3) == 2.4 and len(group.records) == 4


def test_restated_figures_are_counted_once():
    doc = DocumentContext(
        id="b",
        filename="bescom.pdf",
        organisation="P",
        facts=[
            fact("consumption_kwh", 63000, "2024-06-01", "2024-07-01", unit="KWH"),
            fact("net_consumption_kwh", 63000, "2024-06-01", "2024-07-01", unit="kWh"),
            fact("consumption_kvah", 63359.86, "2024-06-01", "2024-07-01", unit="KVAH"),
        ],
    )
    summary = summarise([doc], FinancialYear(2024), "electricity")
    assert [(g.total, g.unit) for g in summary.groups] == [(63000, "KWH"), (63359.86, "KVAH")]
    assert any(
        "net_consumption_kwh" in e or "Also printed" in e for e in summary.groups[0].excluded
    )
    assert len(summary.notes) == len(set(summary.notes))
