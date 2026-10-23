import io

from openpyxl import Workbook

from kuki_ai.monthly import split_listed
from kuki_ai.parsing import parse_document
from kuki_ai.schemas import Fact, Locator


def listed(cell_range: str, *, sheet="Monthly Summary 2026", value_number=None) -> Fact:
    """A monthly column stored as one fact, its values as a list."""
    return Fact(
        key="monthly_kwh_2026",
        label="kWh",
        category="consumption",
        metric="electricity",
        value_text="Jan 100; Feb 200; Mar 300",
        value_number=value_number,
        unit="kWh",
        period_start="2026-01-01",
        period_end="2026-12-31",
        locator=Locator(sheet=sheet, cell_range=cell_range),
        quote="Jan 100; Feb 200; Mar 300",
    )


def test_a_listed_monthly_column_becomes_one_fact_per_month(workbook_xlsx):
    segments = parse_document(workbook_xlsx, "book.xlsx").segments
    facts = split_listed([listed("B2:B4")], segments)

    assert [(f.key, f.value_number, f.period_start, f.period_end) for f in facts] == [
        ("monthly_kwh_2026_2026_01", 100, "2026-01-01", "2026-01-31"),
        ("monthly_kwh_2026_2026_02", 200, "2026-02-01", "2026-02-28"),
        ("monthly_kwh_2026_2026_03", 300, "2026-03-01", "2026-03-31"),
    ]
    assert {f.series for f in facts} == {"kWh"}
    assert [f.locator.cell_range for f in facts] == ["B2", "B3", "B4"]
    assert facts[0].label == "kWh, Jan 2026"
    # Each split fact is checked against its own cell.
    assert all(f.verified for f in facts)
    # Already split facts pass through, so running it again changes nothing.
    assert split_listed(facts, segments) == facts


def test_ranges_that_cannot_be_placed_in_months_are_left_alone(workbook_xlsx):
    segments = parse_document(workbook_xlsx, "book.xlsx").segments
    # B5 is the "ANNUAL TOTAL" row, which isn't a month.
    with_total = listed("B2:B5")
    # A fact that already has one number is a single value, not a list.
    single = listed("B2:B4", value_number=600)

    assert split_listed([with_total, single], segments) == [with_total, single]


def test_quarter_rows_are_not_booked_to_their_first_month():
    wb = Workbook()
    ws = wb.active
    ws.title = "Quarterly Summary"
    ws.append(["Quarter", "Period", "Total (kWh)"])
    for quarter, months, kwh in [("Q1", "Jan - Mar", 585323), ("Q2", "Apr - Jun", 628300)]:
        ws.append([quarter, months, kwh])
    buf = io.BytesIO()
    wb.save(buf)
    segments = parse_document(buf.getvalue(), "book.xlsx").segments
    quarters = listed("C2:C3", sheet="Quarterly Summary")

    assert split_listed([quarters], segments) == [quarters]
