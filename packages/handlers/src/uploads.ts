import { config } from "@kuki/config";
import { db, isUniqueViolation } from "@kuki/drizzle";
import {
  type DocumentRow,
  documents,
  originalStatuses,
} from "@kuki/drizzle/schema";
import { UploadNotFoundError } from "@kuki/handlers/errors";
import { recordEvent } from "@kuki/handlers/events";
import { headObject, presignPut } from "@kuki/s3";
import { sendJson } from "@kuki/sqs";
import type {
  CompleteUploadResult,
  ExtractionJob,
  UploadRequestFile,
  UploadSlot,
} from "@kuki/types";
import { and, eq, inArray } from "drizzle-orm";

// S3 user metadata must be ASCII, and filenames often aren't ("Nestlé").
const encodeFilename = (name: string) => encodeURIComponent(name);

const keyFor = (uploadId: string) => `${config.uploads.prefix}${uploadId}`;

/** The document already holding this content, if any. */
async function findOriginal(sha256: string) {
  const [row] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.sha256, sha256),
        inArray(documents.status, originalStatuses),
      ),
    )
    .limit(1);
  return row?.id;
}

/**
 * Step 1: record each file and presign a PUT for it. Files whose content is
 * already in the system (or earlier in the same batch) are recorded as
 * duplicates and get no URL, so they're never uploaded.
 */
export async function createUploads(
  files: UploadRequestFile[],
): Promise<UploadSlot[]> {
  const { bucket, urlExpiresInSeconds } = config.uploads;
  const expiresAt = new Date(
    Date.now() + urlExpiresInSeconds * 1000,
  ).toISOString();

  const hashes = [...new Set(files.map((f) => f.sha256))];
  const existing = await db
    .select({ id: documents.id, sha256: documents.sha256 })
    .from(documents)
    .where(
      and(
        inArray(documents.sha256, hashes),
        inArray(documents.status, originalStatuses),
      ),
    );
  const originalBySha = new Map(existing.map((d) => [d.sha256, d.id]));

  const planned = files.map((file) => {
    const id = crypto.randomUUID();
    const duplicateOf = originalBySha.get(file.sha256);
    if (!duplicateOf) originalBySha.set(file.sha256, id); // later copies in this batch
    return { id, file, duplicateOf };
  });

  await db.transaction(async (tx) => {
    await tx.insert(documents).values(
      planned.map(({ id, file, duplicateOf }) => ({
        id,
        filename: file.filename,
        contentType: file.contentType,
        size: file.size,
        sha256: file.sha256,
        ...(duplicateOf
          ? { status: "duplicate" as const, duplicateOf }
          : { status: "awaiting_upload" as const, bucket, s3Key: keyFor(id) }),
      })),
    );
    for (const { id, file, duplicateOf } of planned) {
      if (duplicateOf)
        await recordEvent(
          tx,
          id,
          "duplicate",
          `${file.filename} skipped as a duplicate.`,
        );
      else
        await recordEvent(
          tx,
          id,
          "upload_started",
          `${file.filename} upload started.`,
        );
    }
  });

  return Promise.all(
    planned.map(async ({ id, file, duplicateOf }): Promise<UploadSlot> => {
      if (duplicateOf)
        return { status: "duplicate", uploadId: id, duplicateOf };
      const key = keyFor(id);
      const { url, headers } = await presignPut({
        bucket,
        key,
        contentType: file.contentType,
        contentLength: file.size,
        metadata: {
          filename: encodeFilename(file.filename),
          sha256: file.sha256,
        },
        expiresIn: urlExpiresInSeconds,
      });
      return {
        status: "upload",
        uploadId: id,
        key,
        url,
        method: "PUT",
        headers,
        expiresAt,
      };
    }),
  );
}

const jobFor = (doc: DocumentRow, uploadedAt: Date): ExtractionJob => ({
  type: "document.uploaded",
  uploadId: doc.id,
  bucket: doc.bucket ?? config.uploads.bucket,
  key: doc.s3Key ?? keyFor(doc.id),
  filename: doc.filename,
  contentType: doc.contentType,
  size: doc.size,
  sha256: doc.sha256,
  uploadedAt: uploadedAt.toISOString(),
});

const result = (
  doc: DocumentRow,
  status: CompleteUploadResult["status"],
): CompleteUploadResult => ({
  uploadId: doc.id,
  status,
  filename: doc.filename,
  size: doc.size,
});

/**
 * Step 2: once the browser's PUT succeeded, confirm the object is in S3, mark
 * the document queued and send the extraction job.
 *
 * Idempotent: a document that's already past `awaiting_upload` is returned as
 * `already_completed` and not queued again.
 */
export async function completeUpload(
  uploadId: string,
): Promise<CompleteUploadResult> {
  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, uploadId),
  });
  if (!doc) throw new UploadNotFoundError(uploadId);
  if (doc.status === "duplicate") return result(doc, "duplicate");
  if (doc.status !== "awaiting_upload") return result(doc, "already_completed");

  const object = await headObject(
    doc.bucket ?? config.uploads.bucket,
    doc.s3Key ?? keyFor(doc.id),
  );
  if (!object) throw new UploadNotFoundError(uploadId);

  const uploadedAt = new Date();
  let claimed: DocumentRow | undefined;
  try {
    [claimed] = await db
      .update(documents)
      .set({ status: "queued", uploadedAt })
      .where(
        and(
          eq(documents.id, uploadId),
          eq(documents.status, "awaiting_upload"),
        ),
      )
      .returning();
  } catch (err) {
    // Another upload of the same content got queued first.
    if (!isUniqueViolation(err, "documents_sha256_original_idx")) throw err;
    const duplicateOf = await findOriginal(doc.sha256);
    await db
      .update(documents)
      .set({ status: "duplicate", duplicateOf, uploadedAt })
      .where(eq(documents.id, uploadId));
    await recordEvent(
      db,
      uploadId,
      "duplicate",
      `${doc.filename} skipped as a duplicate.`,
    );
    return result(doc, "duplicate");
  }
  // A concurrent call for the same upload claimed it first.
  if (!claimed) return result(doc, "already_completed");

  try {
    await sendJson(config.extractionQueueUrl, jobFor(claimed, uploadedAt));
  } catch (err) {
    // Put it back so the client can retry completing.
    await db
      .update(documents)
      .set({ status: "awaiting_upload", uploadedAt: null })
      .where(eq(documents.id, uploadId));
    throw err;
  }
  await recordEvent(
    db,
    uploadId,
    "queued",
    `${doc.filename} queued for extraction.`,
  );
  return result(claimed, "queued");
}
