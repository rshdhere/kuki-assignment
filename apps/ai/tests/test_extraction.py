import io

from openpyxl import Workbook

from kuki_ai.extraction import _split_ranges
from kuki_ai.grounding import verify
from kuki_ai.parsing import parse_document
from kuki_ai.schemas import FactOut, Locator, SourceOut


def listed(cell_range: str, *, value_number=None) -> FactOut:
    """A monthly column the model returned as one fact, its values as a list."""
    return FactOut(
        key="monthly_kwh_2026",
        label="kWh",
        category="consumption",
        metric="electricity",
        series=None,
        value_text="Jan 100; Feb 200; Mar 300",
        value_number=value_number,
        unit="kWh",
        period_start="2026-01-01",
        period_end="2026-12-31",
        note=None,
        source=SourceOut(
            page=None,
            sheet="Monthly Summary 2026",
            cell_range=cell_range,
            quote="Jan 100; Feb 200; Mar 300",
        ),
    )


def test_a_listed_monthly_column_becomes_one_fact_per_month(workbook_xlsx):
    segments = parse_document(workbook_xlsx, "book.xlsx").segments
    facts = _split_ranges([listed("B2:B4")], segments)

    assert [(f.key, f.value_number, f.period_start, f.period_end) for f in facts] == [
        ("monthly_kwh_2026_2026_01", 100, "2026-01-01", "2026-01-31"),
        ("monthly_kwh_2026_2026_02", 200, "2026-02-01", "2026-02-28"),
        ("monthly_kwh_2026_2026_03", 300, "2026-03-01", "2026-03-31"),
    ]
    assert {f.series for f in facts} == {"kWh"}
    assert [f.source.cell_range for f in facts] == ["B2", "B3", "B4"]
    assert facts[0].label == "kWh, Jan 2026"
    # Each split fact still checks out against its own cell.
    for f in facts:
        locator = Locator(sheet=f.source.sheet, cell_range=f.source.cell_range)
        assert verify(segments, locator, f.source.quote, f.value_number)[0]


def test_ranges_that_cannot_be_placed_in_months_are_left_alone(workbook_xlsx):
    segments = parse_document(workbook_xlsx, "book.xlsx").segments
    # B5 is the "ANNUAL TOTAL" row, which isn't a month.
    with_total = listed("B2:B5")
    # A fact that already has one number is a single value, not a list.
    single = listed("B2:B4", value_number=600)

    assert _split_ranges([with_total, single], segments) == [with_total, single]


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
    quarters = listed("C2:C3").model_copy(
        update={
            "source": SourceOut(page=None, sheet="Quarterly Summary", cell_range="C2:C3", quote="")
        }
    )

    assert _split_ranges([quarters], segments) == [quarters]
