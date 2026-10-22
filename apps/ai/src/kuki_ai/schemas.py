"""Data shapes shared by extraction, question answering and the HTTP API.

Models whose name ends in `Out` are what the LLM fills in through structured
outputs. They have no defaults because strict JSON schemas require every field;
optional values are nullable instead.
"""

from typing import Literal

from pydantic import BaseModel, Field

DocType = Literal[
    "electricity_bill",
    "water_bill",
    "consumption_workbook",
    "waste_record",
    "policy",
    "other",
]

FactCategory = Literal[
    "consumption",
    "meter_reading",
    "amount",
    "quantity",
    "period",
    "date",
    "identifier",
    "rate",
    "scope",
    "commitment",
    "party",
    "other",
]

Metric = Literal["electricity", "water", "waste", "fuel", "emissions", "cost", "other"]


class Locator(BaseModel):
    """Where a fact lives: a PDF page, or a sheet and cell range."""

    page: int | None = None
    sheet: str | None = None
    cell_range: str | None = None

    def label(self) -> str:
        if self.sheet:
            return f"{self.sheet}!{self.cell_range}" if self.cell_range else self.sheet
        return f"p.{self.page}" if self.page else "document"


class Segment(BaseModel):
    """A citable slice of a document: one PDF page, or one block of sheet rows."""

    ordinal: int
    locator: Locator
    text: str
    # Sheet segments only: cell ref -> value, used to verify and compute over cells.
    cells: dict[str, float | str] | None = None
    # True when the page had no text layer and was read from an image.
    scanned: bool = False


# --- Extraction (LLM output) -------------------------------------------------


class SourceOut(BaseModel):
    page: int | None = Field(description="1-based PDF page number, null for spreadsheets")
    sheet: str | None = Field(description="Sheet name for spreadsheets, null for PDFs")
    cell_range: str | None = Field(description="A1-style cell or range, e.g. F16 or F3:F14")
    quote: str = Field(
        description="Text copied verbatim from the page or cell(s) that states the value"
    )


class FactOut(BaseModel):
    key: str = Field(
        description="snake_case identifier, e.g. units_consumed_kwh, net_payable, "
        "previous_meter_reading, monthly_total_kwh_2026_01"
    )
    label: str = Field(description="Short human label, as the document words it")
    category: FactCategory
    metric: Metric | None = Field(description="What the value measures, if a quantity or amount")
    series: str | None = Field(
        description="For repeated values (monthly rows, columns), the name of the series, "
        "identical across its rows, e.g. 'Total consumption (kWh)'"
    )
    value_text: str = Field(description="The value exactly as written, with its unit or currency")
    value_number: float | None = Field(description="Numeric value without separators, if numeric")
    unit: str | None = Field(description="Unit or currency, e.g. kWh, kVAh, KL, m3, MT, INR")
    period_start: str | None = Field(description="YYYY-MM-DD start of the period it covers")
    period_end: str | None = Field(description="YYYY-MM-DD end of the period it covers")
    note: str | None = Field(description="Qualifiers: assumed unit, ambiguity, what it includes")
    source: SourceOut


class ExtractionOut(BaseModel):
    doc_type: DocType
    title: str = Field(description="What the document is, in a few words")
    organisation: str | None = Field(
        description="The customer/reporting organisation the document is about"
    )
    issuer: str | None = Field(description="Who issued it (utility, authority), if stated")
    period_start: str | None = Field(description="YYYY-MM-DD start of the main period covered")
    period_end: str | None = Field(description="YYYY-MM-DD end of the main period covered")
    summary: str = Field(description="Two sentences on what the document contains")
    facts: list[FactOut]
    issues: list[str] = Field(
        description="Inconsistencies, missing values or ambiguities noticed in the document"
    )


# --- Extraction (API output) -------------------------------------------------


class Fact(BaseModel):
    key: str
    label: str
    category: FactCategory
    metric: Metric | None = None
    series: str | None = None
    value_text: str
    value_number: float | None = None
    unit: str | None = None
    period_start: str | None = None
    period_end: str | None = None
    note: str | None = None
    origin: Literal["reported", "calculated"] = "reported"
    locator: Locator
    quote: str | None = None
    # Whether the quote/value was found at the cited location.
    verified: bool = False
    verification: str = ""
    # How a calculated fact was derived.
    derivation: str | None = None


class Extraction(BaseModel):
    doc_type: DocType
    title: str
    organisation: str | None
    issuer: str | None
    period_start: str | None
    period_end: str | None
    summary: str
    page_count: int | None
    facts: list[Fact]
    issues: list[str]
    segments: list[Segment]
    model: str
    pipeline: str


# --- Question answering ------------------------------------------------------


class DocumentContext(BaseModel):
    """A processed document as stored by the server, passed in for answering."""

    id: str
    filename: str
    doc_type: str | None = None
    organisation: str | None = None
    period_start: str | None = None
    period_end: str | None = None
    summary: str | None = None
    issues: list[str] = []
    facts: list[Fact] = []
    segments: list[Segment] = []


AnswerStatus = Literal["answered", "partial", "insufficient_evidence", "conflicting_evidence"]


class EvidenceOut(BaseModel):
    id: str = Field(description="Short id such as E1, referenced from values and calculations")
    document_id: str
    page: int | None
    sheet: str | None
    cell_range: str | None
    quote: str = Field(description="Verbatim text from that location supporting the answer")


class KeyValueOut(BaseModel):
    label: str
    value: float | None
    value_text: str
    unit: str | None
    period: str | None
    origin: Literal["reported", "calculated"]
    evidence_ids: list[str]
    calculation_id: str | None


class CalculationOut(BaseModel):
    id: str = Field(description="Short id such as C1")
    description: str
    expression: str = Field(
        description="Arithmetic expression that was evaluated with the calculate tool"
    )
    result: float
    unit: str | None
    evidence_ids: list[str]


class AnswerOut(BaseModel):
    status: AnswerStatus
    answer: str = Field(description="Direct answer in a few sentences, citing [E1] style ids")
    key_values: list[KeyValueOut]
    calculations: list[CalculationOut]
    evidence: list[EvidenceOut]
    gaps: list[str] = Field(
        description="Missing information, assumptions, coverage limits and inconsistencies"
    )


class Evidence(EvidenceOut):
    filename: str
    locator_label: str
    verified: bool
    verification: str


class Calculation(CalculationOut):
    computed: float | None
    matches: bool


class Answer(BaseModel):
    question: str
    status: AnswerStatus
    answer: str
    key_values: list[KeyValueOut]
    calculations: list[Calculation]
    evidence: list[Evidence]
    gaps: list[str]
    financial_year: "FinancialYearSummary | None" = None
    model: str
    pipeline: str
    tool_calls: list[dict] = []


# --- Financial year ----------------------------------------------------------


class FyRecord(BaseModel):
    document_id: str
    filename: str
    fact_key: str
    label: str
    value: float
    unit: str | None
    period_start: str
    period_end: str
    overlap_days: int
    period_days: int
    included_value: float
    prorated: bool
    locator_label: str


class FyGroup(BaseModel):
    organisation: str | None
    document_id: str
    filename: str
    metric: str
    series: str | None
    unit: str | None
    total: float
    covered_days: int
    fy_days: int
    coverage_pct: float
    months_covered: list[str]
    months_missing: list[str]
    records: list[FyRecord]
    excluded: list[str]


class FinancialYearSummary(BaseModel):
    fy: str
    start: str
    end: str
    metric: str | None
    groups: list[FyGroup]
    # Totals by unit across groups, only when every group is the same organisation.
    combined: dict[str, float] | None
    notes: list[str]
    documents_without_overlap: list[str]


Answer.model_rebuild()
