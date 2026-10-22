import pytest

from kuki_ai.calc import CalcError, evaluate
from kuki_ai.grounding import expand_range, verify
from kuki_ai.parsing import UnsupportedDocumentError, parse_document
from kuki_ai.schemas import Locator


def test_pdf_pages_become_segments_and_blank_pages_are_scanned(bill_pdf):
    parsed = parse_document(bill_pdf, "bill.pdf")
    assert parsed.page_count == 2
    assert parsed.segments[0].locator.page == 1
    assert "Units Consumed 47407" in parsed.segments[0].text
    assert parsed.segments[1].scanned
    assert set(parsed.page_images) == {2}


def test_xlsx_keeps_cell_refs_and_formulas(workbook_xlsx):
    parsed = parse_document(workbook_xlsx, "book.xlsx")
    [segment] = parsed.segments
    assert segment.locator.sheet == "Monthly Summary 2026"
    assert segment.locator.cell_range == "A1:B6"
    assert segment.cells["B5"] == 650.0
    assert "B6=" in segment.text and "(formula =SUM(B2:B4))" in segment.text


def test_unsupported_and_corrupt_files_are_permanent():
    with pytest.raises(UnsupportedDocumentError):
        parse_document(b"hello", "notes.txt")
    with pytest.raises(UnsupportedDocumentError):
        parse_document(b"not a pdf", "broken.pdf")


def test_verify_quotes_and_values_on_pages(bill_pdf):
    segments = parse_document(bill_pdf, "bill.pdf").segments
    assert verify(segments, Locator(page=1), "Units  Consumed\n47407", 47407)[0]
    # Value present on the page but quote paraphrased.
    assert verify(segments, Locator(page=1), "units used were 47,407", 47407)[0]
    assert not verify(segments, Locator(page=1), "Units Consumed 99999", 99999)[0]
    assert not verify(segments, Locator(page=3), "Units Consumed", None)[0]
    ok, why = verify(segments, Locator(page=2), "anything", None)
    assert not ok and "scanned" in why


def test_verify_cells(workbook_xlsx):
    segments = parse_document(workbook_xlsx, "book.xlsx").segments
    loc = Locator(sheet="Monthly Summary 2026", cell_range="B5")
    assert verify(segments, loc, "650", 650)[0]
    assert not verify(segments, loc, "600", 600)[0]


def test_expand_range():
    assert expand_range("F3:F5") == ["F3", "F4", "F5"]
    assert expand_range("A1:B2") == ["A1", "B1", "A2", "B2"]
    assert expand_range("$C$7") == ["C7"]


def test_calculate_with_sheet_ranges(workbook_xlsx):
    segments = parse_document(workbook_xlsx, "book.xlsx").segments
    assert evaluate("SUM('Monthly Summary 2026'!B2:B4)", segments) == 600
    assert evaluate("'Monthly Summary 2026'!B5 - SUM('Monthly Summary 2026'!B2:B4)", segments) == 50
    assert evaluate("14821 - 12500") == 2321
    assert evaluate("47,407 / 30") == pytest.approx(1580.2333, rel=1e-6)
    assert evaluate("ROUND(1.0 + 0.5 + 0.5 + 0.4, 2)") == 2.4
    with pytest.raises(CalcError):
        evaluate("__import__('os').system('x')")
    with pytest.raises(CalcError):
        evaluate("SUM('Nope'!A1:A3)", segments)


def test_structured_verification_checks_quoted_cells_one_by_one(workbook_xlsx):
    segments = parse_document(workbook_xlsx, "book.xlsx").segments
    loc = Locator(sheet="Monthly Summary 2026", cell_range="A2:B5")
    quote = "A2=Jan | B2=100 ... A5=ANNUAL TOTAL | B5=650"
    # The exact check can't match a quote spanning several cells.
    assert not verify(segments, loc, quote)[0]
    assert verify(segments, loc, quote, structured=True)[0]
    # A wrong value, or a cell outside the cited range, still fails.
    ok, why = verify(segments, loc, "B2=100 | B5=600", structured=True)
    assert not ok and "B5 holds 650" in why
    ok, why = verify(segments, loc, "B6=600", structured=True)
    assert not ok and "outside" in why


def test_structured_verification_reads_numbers_stored_as_text():
    from kuki_ai.schemas import Segment

    segments = [
        Segment(
            ordinal=0,
            locator=Locator(sheet="S", cell_range="A1:B2"),
            text="",
            cells={"A1": "1533290", "B1": "36.8%", "A2": "Grid"},
        )
    ]
    assert not verify(segments, Locator(sheet="S", cell_range="B1"), "36.8%", 36.8)[0]
    assert verify(segments, Locator(sheet="S", cell_range="B1"), "36.8%", 36.8, structured=True)[0]
    assert verify(
        segments, Locator(sheet="S", cell_range="A1"), "1533290", 1533290, structured=True
    )[0]
    assert not verify(
        segments, Locator(sheet="S", cell_range="A1"), "1533291", 1533291, structured=True
    )[0]


def test_structured_verification_matches_quotes_split_by_columns():
    from kuki_ai.schemas import Segment

    # Two columns interleaved line by line, as PyMuPDF returns them.
    page = (
        "Quality is End-to-End          Food Safety is Everyone's job\n"
        "Quality is embedded across the  Each of us plays a vital role\n"
        "entire value chain, from ideation  in delivering our promise\n"
    )
    segments = [Segment(ordinal=0, locator=Locator(page=1), text=page)]
    quote = "Quality is embedded across the\nentire value chain, from ideation"
    assert not verify(segments, Locator(page=1), quote)[0]
    assert verify(segments, Locator(page=1), quote, structured=True)[0]
    # A line that isn't on the page fails the whole quote.
    made_up = "Quality is embedded across the\nentire supply chain, every day"
    assert not verify(segments, Locator(page=1), made_up, structured=True)[0]


def test_structured_verification_matches_negative_amounts(bill_pdf):
    segments = parse_document(bill_pdf, "bill.pdf").segments
    quote = "Units Consumed 47407"
    assert not verify(segments, Locator(page=1), quote, -47407)[0]
    assert verify(segments, Locator(page=1), quote, -47407, structured=True)[0]
