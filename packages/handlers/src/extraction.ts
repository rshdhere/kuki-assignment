import { randomUUID } from "node:crypto";
import { AiServiceError, extract as runExtraction } from "@kuki/ai";
import { config } from "@kuki/config";
import { db } from "@kuki/drizzle";
import {
  type DocumentRow,
  documentSegments,
  documents,
  facts,
} from "@kuki/drizzle/schema";
import { PermanentExtractionError } from "@kuki/handlers/errors";
import { recordEvent } from "@kuki/handlers/events";
import type { AiExtraction, ExtractionJob } from "@kuki/types";
import { and, eq, inArray, isNull } from "drizzle-orm";

class AttemptFailure extends AiServiceError {
  constructor(
    error: unknown,
    readonly token: string,
  ) {
    super(
      error instanceof Error ? error.message : String(error),
      error instanceof AiServiceError ? error.retryable : true,
      error instanceof AiServiceError ? error.status : undefined,
    );
    this.cause = error;
  }
}

class PermanentAttemptFailure extends PermanentExtractionError {
  constructor(
    error: PermanentExtractionError,
    readonly token: string,
  ) {
    super(error.message, { cause: error });
  }
}

/**
 * Processes one job from the extraction queue. Throwing leaves the message on
 * the queue, so it is retried and lands in the DLQ after
 * `config.extraction.maxReceives` receives.
 *
 * Idempotent on `job.uploadId`: SQS delivers at least once, so a job for a
 * document that already succeeded (or is a duplicate) is skipped.
 *
 * @param attempt the SQS receive count of this delivery
 * @returns false if the job was skipped
 */
export async function processExtractionJob(
  job: ExtractionJob,
  attempt: number,
): Promise<boolean> {
  // `extracting` is included so a job whose worker died mid-run can be picked
  // up again, and `failed` so jobs redriven from the DLQ run again.
  const token = randomUUID();
  const [doc] = await db
    .update(documents)
    .set({
      status: "extracting",
      attempts: attempt,
      processingToken: token,
      lastError: null,
      completedAt: null,
    })
    .where(
      and(
        eq(documents.id, job.uploadId),
        inArray(documents.status, [
          "queued",
          "retrying",
          "extracting",
          "failed",
        ]),
      ),
    )
    .returning();
  if (!doc) {
    console.warn(
      `[extraction] ${job.uploadId}: no document in a runnable state, skipping`,
    );
    return false;
  }
  try {
    return await extractClaimedDocument(doc, attempt, token);
  } catch (err) {
    throw err instanceof PermanentExtractionError
      ? new PermanentAttemptFailure(err, token)
      : new AttemptFailure(err, token);
  }
}

async function extractClaimedDocument(
  doc: DocumentRow,
  attempt: number,
  token: string,
) {
  await recordEvent(
    db,
    doc.id,
    "extraction_started",
    `${doc.filename} extraction started.`,
    attempt,
  );

  const extraction = await extract(doc);
  const verified = extraction.facts.filter(
    (f) => f.origin === "reported" && f.verified,
  ).length;
  const reported = extraction.facts.filter(
    (f) => f.origin === "reported",
  ).length;

  // Results and the status change land together, and replace any results of
  // an earlier run, so a redelivered job can't leave duplicates or half a run.
  return db.transaction(async (tx) => {
    // Hold the row lock until facts, source segments and success commit together.
    // A new claim either precedes this lock (and fences us out) or follows it
    // and sees the durable succeeded status, so cannot start another extraction.
    const [owner] = await tx
      .select({ token: documents.processingToken, status: documents.status })
      .from(documents)
      .where(eq(documents.id, doc.id))
      .for("update");
    if (owner?.token !== token || owner.status !== "extracting") return false;
    await tx.delete(facts).where(eq(facts.documentId, doc.id));
    await tx
      .delete(documentSegments)
      .where(eq(documentSegments.documentId, doc.id));
    if (extraction.facts.length)
      await tx.insert(facts).values(
        extraction.facts.map((f) => ({
          documentId: doc.id,
          key: f.key,
          label: f.label,
          category: f.category,
          metric: f.metric,
          series: f.series,
          valueText: f.value_text,
          valueNumber: f.value_number,
          unit: f.unit,
          periodStart: isoDate(f.period_start),
          periodEnd: isoDate(f.period_end),
          note: f.note,
          origin: f.origin,
          locator: f.locator,
          quote: f.quote,
          verified: f.verified,
          verification: f.verification,
          derivation: f.derivation,
        })),
      );
    if (extraction.segments.length)
      await tx.insert(documentSegments).values(
        extraction.segments.map((s) => ({
          documentId: doc.id,
          ordinal: s.ordinal,
          locator: s.locator,
          text: s.text,
          cells: s.cells,
          scanned: s.scanned,
        })),
      );
    await tx
      .update(documents)
      .set({
        status: "succeeded",
        processingToken: null,
        completedAt: new Date(),
        docType: extraction.doc_type,
        title: extraction.title,
        organisation: extraction.organisation,
        issuer: extraction.issuer,
        summary: extraction.summary,
        issues: extraction.issues,
        factCount: extraction.facts.length,
        periodStart: isoDate(extraction.period_start),
        periodEnd: isoDate(extraction.period_end),
        pageCount: extraction.page_count,
      })
      .where(eq(documents.id, doc.id));
    await recordEvent(
      tx,
      doc.id,
      "extraction_succeeded",
      `${doc.filename} finished with ${extraction.facts.length} facts (${verified} of ${reported} reported facts verified at their source).`,
      attempt,
    );
    return true;
  });
}

/**
 * Records a failed attempt. The document goes to `retrying`, or to `failed`
 * once this was the last receive before the DLQ or the error is permanent.
 */
export async function recordExtractionFailure(
  uploadId: string,
  attempt: number,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : String(error);
  const permanent = error instanceof PermanentExtractionError;
  const final = permanent || attempt >= config.extraction.maxReceives;
  const token =
    error instanceof AttemptFailure || error instanceof PermanentAttemptFailure
      ? error.token
      : null;
  return db.transaction(async (tx) => {
    const [doc] = await tx
      .update(documents)
      .set({
        status: final ? "failed" : "retrying",
        processingToken: null,
        attempts: attempt,
        lastError: message,
        completedAt: final ? new Date() : null,
      })
      .where(
        and(
          eq(documents.id, uploadId),
          eq(documents.status, "extracting"),
          token
            ? eq(documents.processingToken, token)
            : isNull(documents.processingToken),
        ),
      )
      .returning({ filename: documents.filename });
    if (!doc) return;
    await recordEvent(
      tx,
      uploadId,
      "extraction_failed",
      permanent
        ? `${doc.filename} cannot be processed: ${message}. Not retried.`
        : final
          ? `${doc.filename} failed on attempt ${attempt} of ${config.extraction.maxReceives}: ${message}. Moved to the DLQ.`
          : `${doc.filename} failed on attempt ${attempt} of ${config.extraction.maxReceives}: ${message}.`,
      attempt,
    );
  });
}

// Postgres `date` columns reject anything but a valid ISO date.
const isoDate = (value: string | null) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
    ? value
    : null;

/** Runs the AI service on the uploaded file. Non-retryable errors become permanent. */
async function extract(doc: DocumentRow): Promise<AiExtraction> {
  try {
    return await runExtraction({
      documentId: doc.id,
      bucket: doc.bucket ?? config.uploads.bucket,
      key: doc.s3Key ?? `${config.uploads.prefix}${doc.id}`,
      filename: doc.filename,
      contentType: doc.contentType,
    });
  } catch (err) {
    if (err instanceof AiServiceError && !err.retryable)
      throw new PermanentExtractionError(err.message, { cause: err });
    throw err;
  }
}
