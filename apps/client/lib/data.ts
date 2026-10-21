// Sample data for the dashboard screens.
// Every figure below was read by hand from the six assignment documents.
// Job states and eval marks are example values until the server exposes them.

export type Origin = "Reported" | "Calculated";
export type JobState = "succeeded" | "extracting" | "retrying" | "duplicate";

export interface DocumentRow {
  file: string;
  meta: string;
  type: string | null;
  organisation: string;
  period: string;
  state: JobState;
  attempts: string;
  note?: string;
}

export const documents: DocumentRow[] = [
  {
    file: "Annual Electricity Consumption.xlsx",
    meta: "4 sheets · 9c1e…a07",
    type: "Workbook",
    organisation: "Not stated",
    period: "Jan – Dec 2026",
    state: "succeeded",
    attempts: "1/3",
  },
  {
    file: "Adani commercial electricity bill.pdf",
    meta: "2 pages · 41b7…e2c",
    type: "Electricity bill",
    organisation: "J Kumar MEPL JV",
    period: "Apr 2024",
    state: "succeeded",
    attempts: "1/3",
  },
  {
    file: "BESCOM Commercial Electricity Bill.pdf",
    meta: "2 pages · d03a…91f",
    type: "Electricity bill",
    organisation: "Prestige Estates Projects",
    period: "Jun 2024",
    state: "succeeded",
    attempts: "2/3",
  },
  {
    file: "water_bill_invoice.pdf",
    meta: "3 pages · 7fe2…c58",
    type: "Water bill",
    organisation: "Coca-Cola Beverages India",
    period: "Dec 2025",
    state: "succeeded",
    attempts: "1/3",
  },
  {
    file: "quality_policy_nestle.pdf",
    meta: "3 pages · 2a64…b19",
    type: "Policy",
    organisation: "Nestlé S.A.",
    period: "Jun 2026",
    state: "extracting",
    attempts: "1/3",
    note: "step 3 of 5",
  },
  {
    file: "form 3 filled.docx.pdf",
    meta: "2 pages · e81c…40d",
    type: "Waste record",
    organisation: "TMTE Metal Tech",
    period: "Mar 2023",
    state: "retrying",
    attempts: "2/3",
    note: "Rate limited (429) · attempt 2 of 3",
  },
  {
    file: "water_bill_invoice (1).pdf",
    meta: "7fe2…c58",
    type: null,
    organisation: "Same content as water_bill_invoice.pdf",
    period: "",
    state: "duplicate",
    attempts: "–",
  },
];

export const activity = [
  {
    time: "00:12:41",
    subject: "form 3 filled.docx.pdf",
    text: "hit a rate limit. Retrying after 4 s.",
  },
  {
    time: "00:12:38",
    subject: "BESCOM bill",
    text: "finished with 14 facts.",
  },
  {
    time: "00:12:30",
    subject: "BESCOM bill",
    text: "timed out after 60 s on attempt 1.",
  },
  {
    time: "00:12:22",
    subject: "water_bill_invoice (1).pdf",
    text: "skipped as a duplicate.",
  },
];

export const queue = [
  ["Workers online", "2"],
  ["Jobs waiting", "1"],
  ["Lease timeout", "120 s"],
  ["Max attempts", "3"],
  ["Backoff", "2ⁿ s"],
] as const;

export interface Fact {
  field: string;
  value: string;
  origin: Origin;
  page?: string;
  note: string;
  /** The line on the page where the value was read; absent for calculated facts. */
  sourceLine?: string;
  /** How a calculated value was derived. */
  derivation?: string;
  strong?: boolean;
}

export const adaniFacts: Fact[] = [
  {
    field: "Billing period",
    value: "01-04-2024 – 30-04-2024",
    origin: "Reported",
    page: "p.1",
    note: "Bill Period",
    sourceLine: "Bill Period: 01-04-2024 - 30.04.2024",
  },
  {
    field: "Units consumed",
    value: "47,407 kWh",
    origin: "Reported",
    page: "p.1",
    note: "Units Consumed · unit assumed",
    sourceLine: "Units Consumed 47407",
    strong: true,
  },
  {
    field: "Current month bill",
    value: "₹6,32,023.17",
    origin: "Reported",
    page: "p.1",
    note: "Current Month Bill",
    sourceLine: "Current Month Bill ₹ 632023.17",
  },
  {
    field: "Previous outstanding",
    value: "₹2.31",
    origin: "Reported",
    page: "p.1",
    note: "Previous Outstanding",
    sourceLine: "Previous Outstanding ₹ 2.31",
  },
  {
    field: "Payable by due date",
    value: "₹6,31,510.00",
    origin: "Reported",
    page: "p.1",
    note: "Due 30-05-2024",
    sourceLine: "₹ 631510.00*  Due Date: 30-05-2024",
    strong: true,
  },
  {
    field: "Payable by discount date",
    value: "₹6,26,420.00",
    origin: "Reported",
    page: "p.1",
    note: "By 16-05-2024",
    sourceLine: "16-05-2024 : Amt ₹ 626420.00",
  },
  {
    field: "Payable after due date",
    value: "₹6,39,410.00",
    origin: "Reported",
    page: "p.1",
    note: "Includes DPC ₹7,900.29",
    sourceLine: "30-05-2024 : Amt ₹ 639410.00#",
  },
  {
    field: "Days in period",
    value: "30",
    origin: "Calculated",
    note: "From period dates",
    derivation: "01-04-2024 to 30-04-2024, inclusive",
  },
  {
    field: "Average per day",
    value: "1,580.2 kWh",
    origin: "Calculated",
    note: "47,407 ÷ 30",
    derivation: "47,407 kWh ÷ 30 days",
  },
];

export const adaniDetails = [
  ["Consumer", "J Kumar MEPL JV"],
  ["Account", "CA 153394579"],
  ["Tariff", "LT II (C), commercial"],
  ["Bill date", "09-05-2024"],
  ["Location", "Kurla (West), Mumbai"],
  ["Indian FY", "2024-25"],
] as const;

export const workbookTotals = [
  {
    label: "Sum of Jan–Dec rows",
    kwh: "2,426,123",
    origin: "Calculated" as Origin,
    cell: "F3:F14",
  },
  {
    label: '"ANNUAL TOTAL" row',
    kwh: "2,425,123",
    origin: "Reported" as Origin,
    cell: "F16",
  },
  {
    label: 'Quarterly "ANNUAL" row',
    kwh: "2,427,123",
    origin: "Reported" as Origin,
    cell: "Quarterly!G7",
  },
];

export const workbookSources = [
  ["Monthly Summary 2026", "F3:F14", "12 monthly totals"],
  ["Monthly Summary 2026", "F16", "2,425,123"],
  ["Quarterly Summary", "G7", "2,427,123"],
  ["Monthly Summary 2026", "B3:B14, B16", "1,534,290 vs 1,533,290"],
  ["Quarterly Summary", "D2", "175,965 vs 174,965"],
] as const;

export const earlierAnswers = [
  {
    question: "Water usage vs meter readings",
    summary: "Matches · 14,821 − 12,500 = 2,321 m³",
    ok: true,
  },
  {
    question: "Total waste recorded",
    summary: "2.4 MT across 4 entries, 10.03.2023",
  },
  {
    question: "Complaint resolution deadline",
    summary: "Not in the policy · all 3 pages checked",
  },
  {
    question: "Consumption per bill",
    summary: "Adani 47,407 kWh · BESCOM 63,000 kWh",
  },
];

export const scopeDocuments = [
  "Annual Electricity Consumption.xlsx",
  "Adani commercial electricity bill",
  "BESCOM Commercial Electricity Bill",
  "water_bill_invoice",
  "form 3 filled",
  "quality_policy_nestle",
];

/** Monthly totals, Monthly Summary 2026 column F. Null means no document covers the month. */
export const fy202627Months: {
  month: string;
  kwh: number | null;
  open?: boolean;
}[] = [
  { month: "Apr", kwh: 203900 },
  { month: "May", kwh: 214900 },
  { month: "Jun", kwh: 209500 },
  { month: "Jul", kwh: 194100 },
  { month: "Aug", kwh: 198600 },
  { month: "Sep", kwh: 206300 },
  { month: "Oct", kwh: 211600, open: true },
  { month: "Nov", kwh: 203500, open: true },
  { month: "Dec", kwh: 199400, open: true },
  { month: "Jan", kwh: null },
  { month: "Feb", kwh: null },
  { month: "Mar", kwh: null },
];

export const coverage = [
  [
    "Annual Electricity Consumption",
    "Jan – Dec 2026",
    "Apr – Dec",
    "Organisation not named",
  ],
  ["Adani electricity bill", "Apr 2024", "No", "FY 2024-25"],
  ["BESCOM electricity bill", "Jun 2024", "No", "FY 2024-25"],
  ["Water bill invoice", "Dec 2025", "No", "FY 2025-26"],
  ["Form 3 waste record", "10 Mar 2023", "No", "FY 2022-23"],
  ["Nestlé quality policy", "Jun 2026", "n/a", "No quantities to total"],
] as const;

export type Mark = "pass" | "fail" | "partial";

export interface EvalCase {
  id: string;
  question: string;
  expected: string;
  source: string;
  baseline: Mark;
  improved: Mark;
  change?: "fixed" | "regressed";
}

export const evalCases: EvalCase[] = [
  {
    id: "E01",
    question: "Adani units and period",
    expected: "47,407 units, 01-04-2024 to 30-04-2024",
    source: "Adani p.1",
    baseline: "pass",
    improved: "pass",
  },
  {
    id: "E02",
    question: "BESCOM consumption and period",
    expected: "63,000 kWh, not 63,359.86 kVAh · 01-06 to 01-07-2024",
    source: "BESCOM p.1",
    baseline: "fail",
    improved: "pass",
    change: "fixed",
  },
  {
    id: "E03",
    question: "Adani amount payable",
    expected: "₹6,31,510.00, not the discount, late or current-month figure",
    source: "Adani p.1",
    baseline: "fail",
    improved: "pass",
    change: "fixed",
  },
  {
    id: "E04",
    question: "BESCOM net payable",
    expected: "₹8,08,528.00",
    source: "BESCOM p.1",
    baseline: "pass",
    improved: "pass",
  },
  {
    id: "E05",
    question: "Water usage vs meter readings",
    expected: "14,821 − 12,500 = 2,321 m³, matches",
    source: "Water p.1",
    baseline: "pass",
    improved: "pass",
  },
  {
    id: "E06",
    question: "Water total due",
    expected: "₹1,58,733.62, incl. 5% GST ₹7,558.74",
    source: "Water p.1",
    baseline: "pass",
    improved: "pass",
  },
  {
    id: "E07",
    question: "Total waste recorded",
    expected: "2.4 MT = 1.0 + 0.5 + 0.5 + 0.4",
    source: "Form 3 p.1",
    baseline: "pass",
    improved: "pass",
  },
  {
    id: "E08",
    question: "Form 3 dates consistent?",
    expected: "No: signed 08.03.2022, entries dated 10.03.2023",
    source: "Form 3 p.1–2",
    baseline: "pass",
    improved: "fail",
    change: "regressed",
  },
  {
    id: "E09",
    question: "Workbook months vs annual",
    expected:
      "Disagree: 2,426,123 summed · 2,425,123 F16 · 2,427,123 Quarterly G7",
    source: "F3:F16 · G7",
    baseline: "partial",
    improved: "partial",
  },
  {
    id: "E10",
    question: "Complaint resolution deadline",
    expected: "Not specified; must say so",
    source: "Policy p.1–3",
    baseline: "pass",
    improved: "pass",
  },
  {
    id: "E11",
    question: "FY 2026-27 electricity",
    expected: "1,841,800 kWh, Apr to Dec only, 9 of 12 months",
    source: "F6:F14",
    baseline: "pass",
    improved: "pass",
  },
  {
    id: "E12",
    question: "FY 2024-25 electricity",
    expected: "Report each bill on its own; different organisations",
    source: "Adani · BESCOM p.1",
    baseline: "fail",
    improved: "pass",
    change: "fixed",
  },
];

export const checkScores = [
  { check: "Answer correct", baseline: 75, improved: 88 },
  { check: "Evidence supports", baseline: 67, improved: 83 },
  { check: "Calculation", baseline: 80, improved: 90 },
  { check: "Gaps stated", baseline: 58, improved: 67 },
];
