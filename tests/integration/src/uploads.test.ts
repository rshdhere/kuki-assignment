import { HeadObjectCommand, NotFound, S3Client } from "@aws-sdk/client-s3";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { db } from "@kuki/drizzle";
import { documents } from "@kuki/drizzle/schema";
import type { ExtractionJob } from "@kuki/types";
import { mockClient } from "aws-sdk-client-mock";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "server/app";
import { eventTypes, getDoc, pdf, sha } from "@/helpers";

const s3 = mockClient(S3Client);
const sqs = mockClient(SQSClient);

beforeEach(() => {
  s3.on(HeadObjectCommand).resolves({ ContentLength: 1234, Metadata: {} });
  sqs.on(SendMessageCommand).resolves({ MessageId: "m-1" });
});

afterEach(() => {
  s3.reset();
  sqs.reset();
});

const startUploads = async (files: unknown[]) => {
  const res = await request(app).post("/uploads").send({ files });
  expect(res.status).toBe(201);
  return res.body.uploads as {
    status: string;
    uploadId: string;
    key?: string;
    url?: string;
    headers?: Record<string, string>;
    duplicateOf?: string;
  }[];
};

const complete = (id: string) => request(app).post(`/uploads/${id}/complete`);

const sentJobs = () =>
  sqs
    .commandCalls(SendMessageCommand)
    .map((c) => JSON.parse(c.args[0].input.MessageBody ?? "") as ExtractionJob);

describe("POST /uploads", () => {
  it("records each file and returns a presigned PUT with the headers to send", async () => {
    const [first, second] = await startUploads([
      pdf(),
      pdf({ filename: "quality_policy_nestlé.pdf", sha256: sha("b") }),
    ]);

    expect(first?.status).toBe("upload");
    expect(first?.uploadId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first?.uploadId).not.toBe(second?.uploadId);
    expect(first?.key).toBe(`uploads/${first?.uploadId}`);
    expect(first?.headers).toEqual({
      "Content-Type": "application/pdf",
      "x-amz-meta-filename": encodeURIComponent(pdf().filename),
      "x-amz-meta-sha256": sha("a"),
    });
    // Non-ASCII filenames are percent-encoded so they're valid S3 metadata.
    expect(second?.headers?.["x-amz-meta-filename"]).toBe(
      "quality_policy_nestl%C3%A9.pdf",
    );

    const url = new URL(first?.url ?? "");
    expect(url.hostname).toContain("kuki-test-bucket");
    expect(url.pathname).toBe(`/${first?.key}`);
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe(
      "content-length;content-type;host;x-amz-meta-filename;x-amz-meta-sha256",
    );
    // A default CRC32 checksum of an empty body would make every real PUT fail.
    expect(url.searchParams.has("x-amz-checksum-crc32")).toBe(false);

    const row = await getDoc(first?.uploadId ?? "");
    expect(row).toMatchObject({
      filename: pdf().filename,
      contentType: "application/pdf",
      size: 1234,
      sha256: sha("a"),
      status: "awaiting_upload",
      bucket: "kuki-test-bucket",
      s3Key: first?.key,
      attempts: 0,
    });
    expect(await eventTypes(first?.uploadId ?? "")).toEqual(["upload_started"]);
  });

  it("skips content that's already in the system", async () => {
    const [original] = await startUploads([pdf()]);
    await complete(original?.uploadId ?? "");

    const [dup] = await startUploads([pdf({ filename: "copy.pdf" })]);

    expect(dup).toEqual({
      status: "duplicate",
      uploadId: expect.any(String),
      duplicateOf: original?.uploadId,
    });
    expect(await getDoc(dup?.uploadId ?? "")).toMatchObject({
      status: "duplicate",
      duplicateOf: original?.uploadId,
      s3Key: null,
    });
    expect(await eventTypes(dup?.uploadId ?? "")).toEqual(["duplicate"]);
  });

  it("treats a repeated file within one batch as a duplicate of the first", async () => {
    const [a, b] = await startUploads([pdf(), pdf({ filename: "again.pdf" })]);

    expect(a?.status).toBe("upload");
    expect(b).toMatchObject({ status: "duplicate", duplicateOf: a?.uploadId });
  });

  it("lets a file be uploaded again if its earlier upload was never completed", async () => {
    await startUploads([pdf()]);
    const [again] = await startUploads([pdf()]);

    expect(again?.status).toBe("upload");
  });

  it.each([
    ["no files", { files: [] }],
    ["an unsupported type", { files: [pdf({ contentType: "image/png" })] }],
    ["a file over 25 MB", { files: [pdf({ size: 25 * 1024 * 1024 + 1 })] }],
    ["a bad hash", { files: [pdf({ sha256: "abc" })] }],
    ["a missing filename", { files: [pdf({ filename: "  " })] }],
  ])("rejects %s with 400 and records nothing", async (_, body) => {
    const res = await request(app).post("/uploads").send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_request");
    expect(res.body.issues.length).toBeGreaterThan(0);
    expect(await db.select().from(documents)).toHaveLength(0);
  });
});

describe("POST /uploads/:uploadId/complete", () => {
  it("marks the document queued and sends a job built from it", async () => {
    const [u] = await startUploads([
      pdf({ filename: "quality_policy_nestlé.pdf" }),
    ]);
    const id = u?.uploadId ?? "";

    const res = await complete(id);

    expect(res.status).toBe(202);
    expect(res.body).toEqual({
      uploadId: id,
      status: "queued",
      filename: "quality_policy_nestlé.pdf",
      size: 1234,
    });

    expect(s3.commandCalls(HeadObjectCommand)[0]?.args[0].input).toEqual({
      Bucket: "kuki-test-bucket",
      Key: `uploads/${id}`,
    });
    const [call] = sqs.commandCalls(SendMessageCommand);
    expect(call?.args[0].input.QueueUrl).toBe(
      "https://sqs.ap-south-1.amazonaws.com/000000000000/kuki-test-queue",
    );
    const row = await getDoc(id);
    expect(row?.status).toBe("queued");
    expect(row?.uploadedAt).toBeInstanceOf(Date);
    expect(sentJobs()).toEqual([
      {
        type: "document.uploaded",
        uploadId: id,
        bucket: "kuki-test-bucket",
        key: `uploads/${id}`,
        filename: "quality_policy_nestlé.pdf",
        contentType: "application/pdf",
        size: 1234,
        sha256: sha("a"),
        uploadedAt: row?.uploadedAt?.toISOString(),
      },
    ]);
    expect(await eventTypes(id)).toEqual(["upload_started", "queued"]);
  });

  it("is idempotent: completing twice queues the job once", async () => {
    const [u] = await startUploads([pdf()]);
    await complete(u?.uploadId ?? "");

    const res = await complete(u?.uploadId ?? "");

    expect(res.status).toBe(202);
    expect(res.body.status).toBe("already_completed");
    expect(sentJobs()).toHaveLength(1);
  });

  it("turns the loser of a race between identical uploads into a duplicate", async () => {
    // Both start before either is queued, so both get an upload URL.
    const [first] = await startUploads([pdf()]);
    const [second] = await startUploads([
      pdf({ filename: "same-content.pdf" }),
    ]);

    await complete(first?.uploadId ?? "");
    const res = await complete(second?.uploadId ?? "");

    expect(res.body.status).toBe("duplicate");
    expect(await getDoc(second?.uploadId ?? "")).toMatchObject({
      status: "duplicate",
      duplicateOf: first?.uploadId,
    });
    expect(sentJobs().map((j) => j.uploadId)).toEqual([first?.uploadId]);
  });

  it("returns 404 for an unknown upload id", async () => {
    const res = await complete("3f0b8f1e-6a8e-4c1e-9d4a-2a1f7c9b5e10");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("upload_not_found");
    expect(s3.calls()).toHaveLength(0);
  });

  it("returns 404 and leaves the document waiting when the object isn't in S3", async () => {
    s3.on(HeadObjectCommand).rejects(
      new NotFound({ message: "Not Found", $metadata: {} }),
    );
    const [u] = await startUploads([pdf()]);

    const res = await complete(u?.uploadId ?? "");

    expect(res.status).toBe(404);
    expect(sentJobs()).toHaveLength(0);
    expect((await getDoc(u?.uploadId ?? ""))?.status).toBe("awaiting_upload");
  });

  it("rejects an upload id that isn't a UUID", async () => {
    const res = await request(app).post("/uploads/..%2Fsecrets/complete");

    expect(res.status).toBe(400);
    expect(s3.calls()).toHaveLength(0);
  });

  it("returns 500 and puts the document back when SQS is unavailable", async () => {
    sqs.on(SendMessageCommand).rejects(new Error("network down"));
    const [u] = await startUploads([pdf()]);

    const res = await complete(u?.uploadId ?? "");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "internal_error" });
    const row = await getDoc(u?.uploadId ?? "");
    expect(row?.status).toBe("awaiting_upload");
    expect(row?.uploadedAt).toBeNull();

    // So completing again works once SQS is back.
    sqs.on(SendMessageCommand).resolves({ MessageId: "m-2" });
    expect((await complete(u?.uploadId ?? "")).body.status).toBe("queued");
  });
});

describe("CORS", () => {
  it("allows the client origin to call the API", async () => {
    const res = await request(app)
      .options("/uploads")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
  });
});
