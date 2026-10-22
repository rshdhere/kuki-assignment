import { db } from "@kuki/drizzle";
import {
  type DocumentEventRow,
  type DocumentRow,
  type FactRow,
  documentEvents,
  documentSegments,
  documents,
  facts,
} from "@kuki/drizzle/schema";
import type {
  DocumentEvent,
  DocumentSummary,
  Fact,
  Locator,
} from "@kuki/types";
import { desc, eq, lt } from "drizzle-orm";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export const toDocumentSummary = (d: DocumentRow): DocumentSummary => ({
  id: d.id,
  filename: d.filename,
  contentType: d.contentType,
  size: d.size,
  sha256: d.sha256,
  status: d.status,
  duplicateOf: d.duplicateOf,
  attempts: d.attempts,
  lastError: d.lastError,
  docType: d.docType,
  title: d.title,
  organisation: d.organisation,
  issuer: d.issuer,
  summary: d.summary,
  issues: d.issues,
  factCount: d.factCount,
  periodStart: d.periodStart,
  periodEnd: d.periodEnd,
  pageCount: d.pageCount,
  createdAt: d.createdAt.toISOString(),
  uploadedAt: iso(d.uploadedAt),
  completedAt: iso(d.completedAt),
});

const toDocumentEvent = (e: DocumentEventRow): DocumentEvent => ({
  id: e.id,
  documentId: e.documentId,
  type: e.type,
  message: e.message,
  attempt: e.attempt,
  createdAt: e.createdAt.toISOString(),
});

export const locatorLabel = (l: Locator) =>
  l.sheet
    ? l.cell_range
      ? `${l.sheet}!${l.cell_range}`
      : l.sheet
    : l.page
      ? `p.${l.page}`
      : "document";

export const toFact = (f: FactRow): Fact => ({
  id: f.id,
  documentId: f.documentId,
  key: f.key,
  label: f.label,
  category: f.category,
  metric: f.metric,
  series: f.series,
  valueText: f.valueText,
  valueNumber: f.valueNumber,
  unit: f.unit,
  periodStart: f.periodStart,
  periodEnd: f.periodEnd,
  note: f.note,
  origin: f.origin,
  locator: f.locator,
  locatorLabel: locatorLabel(f.locator),
  quote: f.quote,
  verified: f.verified,
  verification: f.verification,
  derivation: f.derivation,
});

/** Newest first. Pass the last item's `createdAt` as `before` for the next page. */
export async function listDocuments({
  limit = 50,
  before,
}: { limit?: number; before?: Date } = {}) {
  const rows = await db
    .select()
    .from(documents)
    .where(before ? lt(documents.createdAt, before) : undefined)
    .orderBy(desc(documents.createdAt))
    .limit(limit);
  return rows.map(toDocumentSummary);
}

/** The document, its events (oldest first), extracted facts and page text, or null. */
export async function getDocument(id: string) {
  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, id),
  });
  if (!doc) return null;
  const [events, factRows, segments] = await Promise.all([
    db
      .select()
      .from(documentEvents)
      .where(eq(documentEvents.documentId, id))
      .orderBy(documentEvents.createdAt, documentEvents.id),
    db.select().from(facts).where(eq(facts.documentId, id)).orderBy(facts.id),
    db
      .select({
        ordinal: documentSegments.ordinal,
        locator: documentSegments.locator,
        text: documentSegments.text,
        scanned: documentSegments.scanned,
      })
      .from(documentSegments)
      .where(eq(documentSegments.documentId, id))
      .orderBy(documentSegments.ordinal),
  ]);
  return {
    document: toDocumentSummary(doc),
    events: events.map(toDocumentEvent),
    facts: factRows.map(toFact),
    segments: segments.map((s) => ({
      ...s,
      locatorLabel: locatorLabel(s.locator),
    })),
  };
}

/** Latest events across all documents, newest first: the activity feed. */
export async function listEvents({ limit = 20 }: { limit?: number } = {}) {
  const rows = await db
    .select()
    .from(documentEvents)
    .orderBy(desc(documentEvents.createdAt), desc(documentEvents.id))
    .limit(limit);
  return rows.map(toDocumentEvent);
}
