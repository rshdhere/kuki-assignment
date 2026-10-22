export type DocumentStatus =
  /** Row created and URL presigned; the browser hasn't confirmed the PUT yet. */
  | "awaiting_upload"
  | "queued"
  | "extracting"
  /** An attempt failed; SQS will deliver the job again. */
  | "retrying"
  | "succeeded"
  /** Out of attempts; the message is headed for the DLQ. */
  | "failed"
  /** Same content as `duplicateOf`; never uploaded or queued. */
  | "duplicate";

export type DocumentEventType =
  | "upload_started"
  | "queued"
  | "duplicate"
  | "extraction_started"
  | "extraction_failed"
  | "extraction_succeeded";

export interface DocumentSummary {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  sha256: string;
  status: DocumentStatus;
  duplicateOf: string | null;
  attempts: number;
  lastError: string | null;
  docType: string | null;
  title: string | null;
  organisation: string | null;
  issuer: string | null;
  summary: string | null;
  issues: string[];
  factCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  pageCount: number | null;
  createdAt: string;
  uploadedAt: string | null;
  completedAt: string | null;
}

export interface DocumentEvent {
  id: number;
  documentId: string;
  type: DocumentEventType;
  message: string;
  attempt: number | null;
  createdAt: string;
}
