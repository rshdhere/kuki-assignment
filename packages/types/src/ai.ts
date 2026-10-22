// Shapes exchanged with the Python AI service (apps/ai). Its JSON is
// snake_case; extracted facts are stored and served in camelCase, while answers,
// financial-year summaries and eval runs are passed through as the service
// returns them.

export interface Locator {
  page?: number | null;
  sheet?: string | null;
  cell_range?: string | null;
}

export type FactOrigin = "reported" | "calculated";

/** A fact as the AI service returns it from /extract. */
export interface AiFact {
  key: string;
  label: string;
  category: string;
  metric: string | null;
  series: string | null;
  value_text: string;
  value_number: number | null;
  unit: string | null;
  period_start: string | null;
  period_end: string | null;
  note: string | null;
  origin: FactOrigin;
  locator: Locator;
  quote: string | null;
  verified: boolean;
  verification: string;
  derivation: string | null;
}

export interface AiSegment {
  ordinal: number;
  locator: Locator;
  text: string;
  cells: Record<string, number | string> | null;
  scanned: boolean;
}

export interface AiExtraction {
  doc_type: string;
  title: string;
  organisation: string | null;
  issuer: string | null;
  period_start: string | null;
  period_end: string | null;
  summary: string;
  page_count: number | null;
  facts: AiFact[];
  issues: string[];
  segments: AiSegment[];
  model: string;
  pipeline: string;
}

/** A stored fact, as served by GET /documents/:id. */
export interface Fact {
  id: number;
  documentId: string;
  key: string;
  label: string;
  category: string;
  metric: string | null;
  series: string | null;
  valueText: string;
  valueNumber: number | null;
  unit: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  note: string | null;
  origin: FactOrigin;
  locator: Locator;
  /** "p.1" or "Sheet!F3:F14". */
  locatorLabel: string;
  quote: string | null;
  verified: boolean;
  verification: string;
  derivation: string | null;
}

export type AnswerStatus =
  "answered" | "partial" | "insufficient_evidence" | "conflicting_evidence";

export interface AnswerEvidence {
  id: string;
  document_id: string;
  filename: string;
  page: number | null;
  sheet: string | null;
  cell_range: string | null;
  locator_label: string;
  quote: string;
  verified: boolean;
  verification: string;
}

export interface AnswerKeyValue {
  label: string;
  value: number | null;
  value_text: string;
  unit: string | null;
  period: string | null;
  origin: FactOrigin;
  evidence_ids: string[];
  calculation_id: string | null;
}

export interface AnswerCalculation {
  id: string;
  description: string;
  expression: string;
  result: number;
  computed: number | null;
  matches: boolean;
  unit: string | null;
  evidence_ids: string[];
}

export interface FyRecord {
  document_id: string;
  filename: string;
  fact_key: string;
  label: string;
  value: number;
  unit: string | null;
  period_start: string;
  period_end: string;
  overlap_days: number;
  period_days: number;
  included_value: number;
  prorated: boolean;
  locator_label: string;
}

export interface FyGroup {
  organisation: string | null;
  document_id: string;
  filename: string;
  metric: string;
  series: string | null;
  unit: string | null;
  total: number;
  covered_days: number;
  fy_days: number;
  coverage_pct: number;
  months_covered: string[];
  months_missing: string[];
  records: FyRecord[];
  excluded: string[];
}

export interface FinancialYearSummary {
  fy: string;
  start: string;
  end: string;
  metric: string | null;
  groups: FyGroup[];
  combined: Record<string, number> | null;
  notes: string[];
  documents_without_overlap: string[];
}

export interface Answer {
  question: string;
  status: AnswerStatus;
  answer: string;
  key_values: AnswerKeyValue[];
  calculations: AnswerCalculation[];
  evidence: AnswerEvidence[];
  gaps: string[];
  financial_year: FinancialYearSummary | null;
  model: string;
  pipeline: string;
}

/** A stored answer, as served by POST /answers and GET /answers. */
export interface AnswerRecord {
  id: string;
  question: string;
  documentIds: string[];
  status: AnswerStatus;
  answer: Answer;
  createdAt: string;
}
