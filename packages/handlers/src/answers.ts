import {
  type DocumentContext,
  ask,
  financialYear as fySummary,
} from "@kuki/ai";
import { db } from "@kuki/drizzle";
import {
  type AnswerRow,
  answers,
  documentSegments,
  documents,
  facts,
} from "@kuki/drizzle/schema";
import type { Answer, AnswerRecord } from "@kuki/types";
import { and, desc, eq, inArray } from "drizzle-orm";

/**
 * Succeeded documents with their facts and segments, in the AI service's
 * shape. All succeeded documents when `documentIds` is empty.
 */
export async function loadContexts(
  documentIds: string[] = [],
): Promise<DocumentContext[]> {
  const docs = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.status, "succeeded"),
        documentIds.length ? inArray(documents.id, documentIds) : undefined,
      ),
    )
    .orderBy(documents.createdAt);
  if (!docs.length) return [];
  const ids = docs.map((d) => d.id);
  const [factRows, segmentRows] = await Promise.all([
    db
      .select()
      .from(facts)
      .where(inArray(facts.documentId, ids))
      .orderBy(facts.id),
    db
      .select()
      .from(documentSegments)
      .where(inArray(documentSegments.documentId, ids))
      .orderBy(documentSegments.ordinal),
  ]);
  return docs.map((d) => ({
    id: d.id,
    filename: d.filename,
    doc_type: d.docType,
    organisation: d.organisation,
    period_start: d.periodStart,
    period_end: d.periodEnd,
    summary: d.summary,
    issues: d.issues,
    facts: factRows
      .filter((f) => f.documentId === d.id)
      .map((f) => ({
        key: f.key,
        label: f.label,
        category: f.category,
        metric: f.metric,
        series: f.series,
        value_text: f.valueText,
        value_number: f.valueNumber,
        unit: f.unit,
        period_start: f.periodStart,
        period_end: f.periodEnd,
        note: f.note,
        origin: f.origin,
        locator: f.locator,
        quote: f.quote,
        verified: f.verified,
        verification: f.verification,
        derivation: f.derivation,
      })),
    segments: segmentRows
      .filter((s) => s.documentId === d.id)
      .map((s) => ({
        ordinal: s.ordinal,
        locator: s.locator,
        text: s.text,
        cells: s.cells,
        scanned: s.scanned,
      })),
  }));
}

const toAnswerRecord = (a: AnswerRow): AnswerRecord => ({
  id: a.id,
  question: a.question,
  documentIds: a.documentIds,
  status: a.status,
  answer: a.response as Answer,
  createdAt: a.createdAt.toISOString(),
});

/** Answers a question over the selected documents and keeps the answer. */
export async function askQuestion(
  question: string,
  documentIds: string[] = [],
): Promise<AnswerRecord> {
  const contexts = await loadContexts(documentIds);
  const answer = await ask(question, contexts);
  const [row] = await db
    .insert(answers)
    .values({
      question,
      documentIds: contexts.map((c) => c.id),
      status: answer.status,
      response: answer,
    })
    .returning();
  return toAnswerRecord(row!);
}

/** Newest first. */
export async function listAnswers({ limit = 20 }: { limit?: number } = {}) {
  const rows = await db
    .select()
    .from(answers)
    .orderBy(desc(answers.createdAt))
    .limit(limit);
  return rows.map(toAnswerRecord);
}

/** Totals and coverage for an Indian financial year over the selected documents. */
export async function financialYear(
  fy: string,
  metric: string | null,
  documentIds: string[] = [],
) {
  return fySummary(fy, metric, await loadContexts(documentIds));
}
