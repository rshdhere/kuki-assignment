import type { DocumentEventType, DocumentStatus } from "@kuki/types";
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const documentStatus = pgEnum("document_status", [
  "awaiting_upload",
  "queued",
  "extracting",
  "retrying",
  "succeeded",
  "failed",
  "duplicate",
] as const satisfies readonly DocumentStatus[]);

export const documentEventType = pgEnum("document_event_type", [
  "upload_started",
  "queued",
  "duplicate",
  "extraction_started",
  "extraction_failed",
  "extraction_succeeded",
] as const satisfies readonly DocumentEventType[]);

/** Statuses of a document whose content counts as "already in the system". */
export const originalStatuses = [
  "queued",
  "extracting",
  "retrying",
  "succeeded",
] as const satisfies readonly DocumentStatus[];

const timestamptz = (name?: string) =>
  name
    ? timestamp(name, { withTimezone: true, mode: "date" })
    : timestamp({ withTimezone: true, mode: "date" });

/** One row per file the client asked to upload. `id` is the upload id. */
export const documents = pgTable(
  "documents",
  {
    id: uuid().primaryKey(),
    filename: text().notNull(),
    contentType: text().notNull(),
    size: integer().notNull(),
    /** Hex SHA-256, declared by the client and signed into the S3 upload. */
    sha256: text().notNull(),
    /** Null for duplicates, which are never uploaded. */
    bucket: text(),
    s3Key: text().unique("documents_s3_key_unique"),
    status: documentStatus().notNull(),
    duplicateOf: uuid().references((): AnyPgColumn => documents.id),
    /** Extraction attempts so far (the SQS receive count of the latest one). */
    attempts: integer().notNull().default(0),
    /** Ownership of the latest claim; stale workers cannot publish over it. */
    processingToken: uuid(),
    lastError: text(),

    // Filled in by extraction.
    docType: text(),
    title: text(),
    organisation: text(),
    issuer: text(),
    summary: text(),
    /** Inconsistencies and ambiguities the extraction noticed. */
    issues: jsonb().$type<string[]>().notNull().default([]),
    factCount: integer().notNull().default(0),
    periodStart: date({ mode: "string" }),
    periodEnd: date({ mode: "string" }),
    pageCount: integer(),

    createdAt: timestamptz().notNull().defaultNow(),
    /** When the browser confirmed the PUT and the job was queued. */
    uploadedAt: timestamptz(),
    /** When extraction finished, successfully or not. */
    completedAt: timestamptz(),
    updatedAt: timestamptz()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // At most one "original" per content hash. Racing uploads of the same
    // content lose here when they try to become queued, and become duplicates.
    uniqueIndex("documents_sha256_original_idx")
      .on(t.sha256)
      .where(
        sql`${t.status} in ('queued', 'extracting', 'retrying', 'succeeded')`,
      ),
    index("documents_sha256_idx").on(t.sha256),
    index("documents_created_at_idx").on(t.createdAt.desc()),
  ],
);

/** Activity feed: one row per status change. */
export const documentEvents = pgTable(
  "document_events",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    documentId: uuid()
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    type: documentEventType().notNull(),
    message: text().notNull(),
    attempt: integer(),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [
    index("document_events_document_id_idx").on(t.documentId),
    index("document_events_created_at_idx").on(t.createdAt.desc()),
  ],
);

export type DocumentRow = typeof documents.$inferSelect;
export type NewDocumentRow = typeof documents.$inferInsert;
export type DocumentEventRow = typeof documentEvents.$inferSelect;
