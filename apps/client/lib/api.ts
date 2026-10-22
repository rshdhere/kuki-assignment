// Read side of the server API. Upload calls live in lib/upload.ts.

import type {
  AnswerRecord,
  DocumentEvent,
  DocumentSummary,
  Fact,
  FinancialYearSummary,
  Locator,
} from "@kuki/types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(`Can't reach the server at ${API_URL}`, 0);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };
    throw new ApiError(
      body.message ?? body.error ?? `${path} failed (${res.status})`,
      res.status,
    );
  }
  return res.json() as Promise<T>;
}

export interface SegmentView {
  ordinal: number;
  locator: Locator;
  locatorLabel: string;
  text: string;
  scanned: boolean;
}

export interface DocumentDetail {
  document: DocumentSummary;
  events: DocumentEvent[];
  facts: Fact[];
  segments: SegmentView[];
}

export const api = {
  documents: () =>
    request<{ documents: DocumentSummary[] }>("/documents?limit=200").then(
      (r) => r.documents,
    ),
  document: (id: string) => request<DocumentDetail>(`/documents/${id}`),
  events: (limit = 12) =>
    request<{ events: DocumentEvent[] }>(`/events?limit=${limit}`).then(
      (r) => r.events,
    ),
  ask: (question: string, documentIds: string[]) =>
    request<AnswerRecord>("/answers", {
      method: "POST",
      body: JSON.stringify({ question, documentIds }),
    }),
  answers: () =>
    request<{ answers: AnswerRecord[] }>("/answers?limit=20").then(
      (r) => r.answers,
    ),
  financialYear: (fy: string, metric: string | null, documentIds: string[]) => {
    const q = new URLSearchParams({ fy });
    if (metric) q.set("metric", metric);
    if (documentIds.length) q.set("documentIds", documentIds.join(","));
    return request<FinancialYearSummary>(`/financial-year?${q}`);
  },
  evaluations: () => request<Evaluations>("/evaluations"),
};

// --- Eval results, as written by `kuki-eval` in apps/ai -------------------

export type Mark = "pass" | "partial" | "fail" | "error";

export interface EvalChecks {
  answer?: boolean | null;
  evidence?: boolean | null;
  calculation?: boolean | null;
  uncertainty?: boolean | null;
}

export interface EvalCaseResult {
  id: string;
  title: string;
  question: string;
  documents: string[];
  source: string | null;
  answer: { status: string; answer: string; gaps: string[] } | null;
  score: { mark: Mark; checks: EvalChecks; notes: string[] };
}

export interface EvalSummary {
  cases: number;
  pass: number;
  partial: number;
  fail: number;
  error: number;
  score: number;
  checks: Record<string, { passed: number; applicable: number; rate: number }>;
}

export interface EvalRun {
  pipeline: string;
  model: string;
  ran_at: string;
  summary: EvalSummary;
  cases: EvalCaseResult[];
}

export interface Evaluations {
  runs: Record<string, EvalRun | null>;
  comparison: { before: string; after: string } | null;
}
