import { AiServiceError } from "@kuki/ai";
import { db } from "@kuki/drizzle";
import { documentSegments, documents, facts } from "@kuki/drizzle/schema";
import { PermanentExtractionError } from "@kuki/handlers/errors";
import {
  processExtractionJob,
  recordExtractionFailure,
} from "@kuki/handlers/extraction";
import type { DocumentStatus, ExtractionJob } from "@kuki/types";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eventTypes, extraction, getDoc, sha } from "@/helpers";

const { extract } = vi.hoisted(() => ({ extract: vi.fn() }));
vi.mock("@kuki/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@kuki/ai")>()),
  extract,
}));

const id = "3f0b8f1e-6a8e-4c1e-9d4a-2a1f7c9b5e10";

const job: ExtractionJob = {
  type: "document.uploaded",
  uploadId: id,
  bucket: "kuki-test-bucket",
  key: `uploads/${id}`,
  filename: "a.pdf",
  contentType: "application/pdf",
  size: 1,
  sha256: sha("a"),
  uploadedAt: "2026-10-22T10:00:00.000Z",
};

const seed = (status: DocumentStatus) =>
  db.insert(documents).values({
    id,
    filename: "a.pdf",
    contentType: "application/pdf",
    size: 1,
    sha256: sha("a"),
    bucket: "kuki-test-bucket",
    s3Key: `uploads/${id}`,
    status,
  });

beforeEach(() => {
  extract.mockReset().mockResolvedValue(extraction());
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("processExtractionJob", () => {
  it("runs a queued document to succeeded and records the attempt", async () => {
    await seed("queued");

    expect(await processExtractionJob(job, 1)).toBe(true);

    const row = await getDoc(id);
    expect(row).toMatchObject({
      status: "succeeded",
      attempts: 1,
      lastError: null,
    });
    expect(row?.completedAt).toBeInstanceOf(Date);
    expect(await eventTypes(id)).toEqual([
      "extraction_started",
      "extraction_succeeded",
    ]);
    expect(extract).toHaveBeenCalledWith({
      documentId: id,
      bucket: "kuki-test-bucket",
      key: `uploads/${id}`,
      filename: "a.pdf",
      contentType: "application/pdf",
    });
  });

  it("stores the extracted fields, facts and segments", async () => {
    await seed("queued");

    await processExtractionJob(job, 1);

    expect(await getDoc(id)).toMatchObject({
      docType: "electricity_bill",
      organisation: "J Kumar MEPL JV",
      periodStart: "2024-04-01",
      periodEnd: "2024-04-30",
      pageCount: 2,
      factCount: 2,
      issues: ["Unit not printed next to Units Consumed"],
    });
    const stored = await db
      .select()
      .from(facts)
      .where(eq(facts.documentId, id));
    expect(stored.map((f) => [f.key, f.valueNumber, f.origin])).toEqual([
      ["units_consumed", 47407, "reported"],
      ["units_consumed_per_day", 1580.2333, "calculated"],
    ]);
    expect(stored[0]?.locator).toEqual({ page: 1 });
    const segments = await db
      .select()
      .from(documentSegments)
      .where(eq(documentSegments.documentId, id));
    expect(segments).toHaveLength(1);
  });

  it("replaces earlier results when a job runs again", async () => {
    await seed("failed");
    await processExtractionJob(job, 1);
    await db
      .update(documents)
      .set({ status: "retrying" })
      .where(eq(documents.id, id));

    await processExtractionJob(job, 2);

    const stored = await db
      .select()
      .from(facts)
      .where(eq(facts.documentId, id));
    expect(stored).toHaveLength(2);
  });

  it("drops dates the database can't store", async () => {
    extract.mockResolvedValue(
      extraction({ period_start: "30.04.2024", period_end: null }),
    );
    await seed("queued");

    await processExtractionJob(job, 1);

    expect(await getDoc(id)).toMatchObject({
      periodStart: null,
      periodEnd: null,
    });
  });

  it("turns errors the AI service won't retry into permanent failures", async () => {
    extract.mockRejectedValue(
      new AiServiceError("Could not read a.pdf", false, 422),
    );
    await seed("queued");

    await expect(processExtractionJob(job, 1)).rejects.toBeInstanceOf(
      PermanentExtractionError,
    );
  });

  it("leaves retryable AI errors retryable", async () => {
    extract.mockRejectedValue(new AiServiceError("rate limited", true, 503));
    await seed("queued");

    await expect(processExtractionJob(job, 1)).rejects.toBeInstanceOf(
      AiServiceError,
    );
    expect((await getDoc(id))?.status).toBe("extracting");
  });

  it.each(["retrying", "extracting", "failed"] as const)(
    "runs again from %s (retry, worker crash, DLQ redrive)",
    async (status) => {
      await seed(status);

      expect(await processExtractionJob(job, 3)).toBe(true);
      expect((await getDoc(id))?.status).toBe("succeeded");
    },
  );

  it.each(["succeeded", "duplicate", "awaiting_upload"] as const)(
    "skips a redelivered job for a %s document",
    async (status) => {
      await seed(status);

      expect(await processExtractionJob(job, 2)).toBe(false);
      expect((await getDoc(id))?.status).toBe(status);
      expect(await eventTypes(id)).toEqual([]);
    },
  );

  it("skips a job whose document doesn't exist", async () => {
    expect(await processExtractionJob(job, 1)).toBe(false);
  });
});

describe("recordExtractionFailure", () => {
  it("marks the document retrying with the error", async () => {
    await seed("extracting");

    await recordExtractionFailure(id, 2, new Error("Rate limited (429)"));

    const row = await getDoc(id);
    expect(row).toMatchObject({
      status: "retrying",
      attempts: 2,
      lastError: "Rate limited (429)",
      completedAt: null,
    });
    expect(await eventTypes(id)).toEqual(["extraction_failed"]);
  });

  it("marks the document failed on the last receive before the DLQ", async () => {
    await seed("extracting");

    await recordExtractionFailure(id, 10, new Error("timeout"));

    const row = await getDoc(id);
    expect(row?.status).toBe("failed");
    expect(row?.completedAt).toBeInstanceOf(Date);
  });

  it("fails the document on the first attempt when the error is permanent", async () => {
    await seed("extracting");

    await recordExtractionFailure(
      id,
      1,
      new PermanentExtractionError("Unsupported file type"),
    );

    const row = await getDoc(id);
    expect(row).toMatchObject({ status: "failed", attempts: 1 });
    expect(row?.completedAt).toBeInstanceOf(Date);
  });
});

describe("overlapping extraction attempts", () => {
  it("fences duplicate deliveries even when their receive counts are equal", async () => {
    await seed("queued");
    const old = Promise.withResolvers<ReturnType<typeof extraction>>();
    extract
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(extraction({ summary: "new owner" }));
    const older = processExtractionJob(job, 1);
    await vi.waitFor(() => expect(extract).toHaveBeenCalledTimes(1));
    await processExtractionJob(job, 1);
    old.resolve(extraction({ summary: "stale duplicate" }));
    expect(await older).toBe(false);
    expect((await getDoc(id))?.summary).toBe("new owner");
    expect(
      await db.select().from(facts).where(eq(facts.documentId, id)),
    ).toHaveLength(2);
  });

  it("does not let a late success undo the current owner's permanent failure", async () => {
    await seed("queued");
    const old = Promise.withResolvers<ReturnType<typeof extraction>>();
    extract
      .mockReturnValueOnce(old.promise)
      .mockRejectedValueOnce(
        new AiServiceError("corrupt document", false, 422),
      );
    const older = processExtractionJob(job, 1);
    await vi.waitFor(() => expect(extract).toHaveBeenCalledTimes(1));
    await processExtractionJob(job, 2).catch((err: unknown) =>
      recordExtractionFailure(id, 2, err),
    );
    old.resolve(extraction());
    expect(await older).toBe(false);
    expect(await getDoc(id)).toMatchObject({
      status: "failed",
      attempts: 2,
      lastError: "corrupt document",
    });
    expect(
      await db.select().from(facts).where(eq(facts.documentId, id)),
    ).toHaveLength(0);
  });

  it("does not let an older failed attempt undo a newer success", async () => {
    await seed("queued");
    const old = Promise.withResolvers<ReturnType<typeof extraction>>();
    extract
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(extraction());
    const older = processExtractionJob(job, 1).catch((err: unknown) =>
      recordExtractionFailure(id, 1, err),
    );
    await vi.waitFor(() => expect(extract).toHaveBeenCalledTimes(1));
    await processExtractionJob(job, 2);
    expect((await getDoc(id))?.status).toBe("succeeded");

    old.reject(new AiServiceError("old request timed out", true, 503));
    await older;

    expect(await getDoc(id)).toMatchObject({
      status: "succeeded",
      attempts: 2,
      lastError: null,
    });
  });

  it("does not replace newer facts with a late result from an older attempt", async () => {
    await seed("queued");
    const old = Promise.withResolvers<ReturnType<typeof extraction>>();
    extract
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(
        extraction({ summary: "newer successful extraction" }),
      );
    const older = processExtractionJob(job, 1);
    await vi.waitFor(() => expect(extract).toHaveBeenCalledTimes(1));
    await processExtractionJob(job, 2);

    old.resolve(extraction({ summary: "obsolete older extraction" }));
    await older;

    expect((await getDoc(id))?.summary).toBe("newer successful extraction");
  });
});
