import { config } from "@kuki/config";
import type {
  AiExtraction,
  AiFact,
  AiSegment,
  Answer,
  FinancialYearSummary,
} from "@kuki/types";

/**
 * The AI service failed. `retryable` is true for rate limits, timeouts and
 * the service being down, and false for input it can never process.
 */
export class AiServiceError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AiServiceError";
  }
}

/** A processed document, as the AI service expects it for answers and FY totals. */
export interface DocumentContext {
  id: string;
  filename: string;
  doc_type: string | null;
  organisation: string | null;
  period_start: string | null;
  period_end: string | null;
  summary: string | null;
  issues: string[];
  facts: AiFact[];
  segments: AiSegment[];
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${config.ai.url}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.ai.timeoutMs),
    });
  } catch (err) {
    // Connection refused, DNS, or our own timeout: the service may come back.
    throw new AiServiceError(
      `AI service unreachable at ${config.ai.url}${path}: ${(err as Error).message}`,
      true,
    );
  }
  if (res.ok) return (await res.json()) as T;

  const payload = (await res.json().catch(() => ({}))) as {
    message?: string;
    detail?: unknown;
    retryable?: boolean;
  };
  const message =
    payload.message ??
    (typeof payload.detail === "string"
      ? payload.detail
      : JSON.stringify(payload.detail ?? res.statusText));
  // The service flags its own errors; anything else 5xx is worth a retry.
  const retryable = payload.retryable ?? res.status >= 500;
  throw new AiServiceError(message, retryable, res.status);
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${config.ai.url}${path}`, {
    signal: AbortSignal.timeout(10_000),
  }).catch((err: Error) => {
    throw new AiServiceError(`AI service unreachable: ${err.message}`, true);
  });
  if (!res.ok)
    throw new AiServiceError(`GET ${path}: ${res.status}`, true, res.status);
  return (await res.json()) as T;
}

export const extract = (input: {
  documentId: string;
  bucket: string;
  key: string;
  filename: string;
  contentType: string;
}) =>
  post<AiExtraction>("/extract", {
    document_id: input.documentId,
    bucket: input.bucket,
    key: input.key,
    filename: input.filename,
    content_type: input.contentType,
  });

export const ask = (question: string, documents: DocumentContext[]) =>
  post<Answer>("/ask", { question, documents });

export const financialYear = (
  fy: string,
  metric: string | null,
  documents: DocumentContext[],
) => post<FinancialYearSummary>("/financial-year", { fy, metric, documents });

export const evaluations = () => get<unknown>("/evaluations");
