import type { AnswerStatus, Locator } from "@kuki/types";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { documents } from "@kuki/drizzle/schema/documents";

export const factOrigin = pgEnum("fact_origin", ["reported", "calculated"]);

/**
 * Facts extracted from a document. Each one points at the page or sheet range
 * it was read from; calculated facts carry their derivation instead of a quote.
 * Replaced as a whole when a document is extracted again.
 */
export const facts = pgTable(
  "facts",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    documentId: uuid()
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    key: text().notNull(),
    label: text().notNull(),
    category: text().notNull(),
    metric: text(),
    series: text(),
    valueText: text().notNull(),
    valueNumber: doublePrecision(),
    unit: text(),
    periodStart: date({ mode: "string" }),
    periodEnd: date({ mode: "string" }),
    note: text(),
    origin: factOrigin().notNull(),
    locator: jsonb().$type<Locator>().notNull(),
    quote: text(),
    /** Whether the quote or value was found at the cited location. */
    verified: boolean().notNull(),
    verification: text().notNull(),
    derivation: text(),
  },
  (t) => [index("facts_document_id_idx").on(t.documentId)],
);

/**
 * The document's text as citable segments (a PDF page, or a block of sheet
 * rows with its cell values). Questions are answered over these, and evidence
 * quotes are checked against them.
 */
export const documentSegments = pgTable(
  "document_segments",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    documentId: uuid()
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    ordinal: integer().notNull(),
    locator: jsonb().$type<Locator>().notNull(),
    text: text().notNull(),
    cells: jsonb().$type<Record<string, number | string>>(),
    scanned: boolean().notNull().default(false),
  },
  (t) => [index("document_segments_document_id_idx").on(t.documentId)],
);

/** Questions asked and the AI service's full answer, kept for review. */
export const answers = pgTable(
  "answers",
  {
    id: uuid().primaryKey().defaultRandom(),
    question: text().notNull(),
    documentIds: uuid()
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    status: text().$type<AnswerStatus>().notNull(),
    response: jsonb().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("answers_created_at_idx").on(t.createdAt.desc())],
);

export type FactRow = typeof facts.$inferSelect;
export type NewFactRow = typeof facts.$inferInsert;
export type SegmentRow = typeof documentSegments.$inferSelect;
export type AnswerRow = typeof answers.$inferSelect;
