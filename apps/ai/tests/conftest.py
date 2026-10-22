import io

import pymupdf
import pytest
from openpyxl import Workbook


@pytest.fixture
def bill_pdf() -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Bill Period: 01-04-2024 - 30.04.2024")
    page.insert_text((72, 96), "Units Consumed 47407")
    page.insert_text((72, 120), "Amount payable by due date Rs 631510.00")
    doc.new_page()  # blank: no text layer, treated as scanned
    return doc.tobytes()


@pytest.fixture
def workbook_xlsx() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Monthly Summary 2026"
    ws.append(["Month", "kWh"])
    for month, kwh in [("Jan", 100), ("Feb", 200), ("Mar", 300)]:
        ws.append([month, kwh])
    ws.append(["ANNUAL TOTAL", 650])  # hard-coded and wrong on purpose
    ws.append(["Formula total", "=SUM(B2:B4)"])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
