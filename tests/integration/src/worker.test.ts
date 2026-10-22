import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { PermanentExtractionError } from "@kuki/handlers/errors";
import type { ExtractionJob } from "@kuki/types";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, describe, expect, it, vi } from "vitest";
import { backoffSeconds, handleMessage, runConsumer } from "worker/consumer";

const { processExtractionJob, recordExtractionFailure } = vi.hoisted(() => ({
  processExtractionJob: vi.fn(),
  recordExtractionFailure: vi.fn(),
}));
vi.mock("@kuki/handlers/extraction", () => ({
  processExtractionJob,
  recordExtractionFailure,
}));

const sqs = mockClient(SQSClient);
recordExtractionFailure.mockResolvedValue(undefined);
const queueUrl = "https://sqs.ap-south-1.amazonaws.com/000000000000/q";

afterEach(() => {
  sqs.reset();
  processExtractionJob.mockReset();
  recordExtractionFailure.mockReset().mockResolvedValue(undefined);
});

const job: ExtractionJob = {
  type: "document.uploaded",
  uploadId: "3f0b8f1e-6a8e-4c1e-9d4a-2a1f7c9b5e10",
  bucket: "b",
  key: "uploads/3f0b8f1e-6a8e-4c1e-9d4a-2a1f7c9b5e10",
  filename: "a.pdf",
  contentType: "application/pdf",
  size: 1,
  sha256: "a".repeat(64),
  uploadedAt: "2026-10-22T10:00:00.000Z",
};

const message = (body: unknown, receiveCount = 1) => ({
  messageId: "m-1",
  receiptHandle: "rh-1",
  receiveCount,
  body,
});

describe("worker handleMessage", () => {
  it("processes the job and deletes the message", async () => {
    await handleMessage(queueUrl, message(job));

    expect(processExtractionJob).toHaveBeenCalledWith(job, 1);
    const [del] = sqs.commandCalls(DeleteMessageCommand);
    expect(del?.args[0].input).toEqual({
      QueueUrl: queueUrl,
      ReceiptHandle: "rh-1",
    });
  });

  it("records the failure, keeps the message and backs off", async () => {
    const error = new Error("rate limited");
    processExtractionJob.mockRejectedValue(error);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await handleMessage(queueUrl, message(job, 2));

    expect(recordExtractionFailure).toHaveBeenCalledWith(
      job.uploadId,
      2,
      error,
    );
    expect(sqs.commandCalls(DeleteMessageCommand)).toHaveLength(0);
    const [vis] = sqs.commandCalls(ChangeMessageVisibilityCommand);
    expect(vis?.args[0].input.VisibilityTimeout).toBe(60);
  });

  it("deletes the message after a permanent failure instead of retrying", async () => {
    const error = new PermanentExtractionError("Unsupported file type");
    processExtractionJob.mockRejectedValue(error);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await handleMessage(queueUrl, message(job, 1));

    expect(recordExtractionFailure).toHaveBeenCalledWith(
      job.uploadId,
      1,
      error,
    );
    expect(sqs.commandCalls(DeleteMessageCommand)).toHaveLength(1);
    expect(sqs.commandCalls(ChangeMessageVisibilityCommand)).toHaveLength(0);
  });

  it("keeps a permanently failed message if the failure couldn't be recorded", async () => {
    processExtractionJob.mockRejectedValue(new PermanentExtractionError("x"));
    recordExtractionFailure.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await handleMessage(queueUrl, message(job, 1));

    expect(sqs.commandCalls(DeleteMessageCommand)).toHaveLength(0);
    expect(sqs.commandCalls(ChangeMessageVisibilityCommand)).toHaveLength(1);
  });

  it("leaves malformed messages for the DLQ without processing them", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    await handleMessage(queueUrl, message(undefined));
    await handleMessage(queueUrl, message({ type: "something.else" }));

    expect(processExtractionJob).not.toHaveBeenCalled();
    expect(sqs.calls()).toHaveLength(0);
  });

  it("doubles the backoff per attempt and caps it at the visibility timeout", () => {
    expect([1, 2, 3, 4, 5].map(backoffSeconds)).toEqual([
      30, 60, 120, 240, 300,
    ]);
  });
});

describe("worker runConsumer", () => {
  const sqsMessage = (id: string) => ({
    MessageId: id,
    ReceiptHandle: `rh-${id}`,
    Attributes: { ApproximateReceiveCount: "1" },
    Body: JSON.stringify({ ...job, uploadId: id }),
  });

  it("keeps receiving while a slow job runs, up to the concurrency limit", async () => {
    const controller = new AbortController();
    const finished: string[] = [];
    let releaseSlow!: () => void;
    processExtractionJob.mockImplementation(async (j: ExtractionJob) => {
      if (j.uploadId === "slow")
        await new Promise<void>((r) => (releaseSlow = r));
      finished.push(j.uploadId);
    });
    sqs
      .on(ReceiveMessageCommand)
      .resolvesOnce({ Messages: [sqsMessage("slow"), sqsMessage("fast-1")] })
      .resolvesOnce({ Messages: [sqsMessage("fast-2")] })
      .callsFake(async () => {
        // Nothing left: release the slow job and stop.
        releaseSlow();
        controller.abort();
        return { Messages: [] };
      });

    await runConsumer(queueUrl, controller.signal, 2);

    expect(finished).toEqual(["fast-1", "fast-2", "slow"]);
    const asked = sqs
      .commandCalls(ReceiveMessageCommand)
      .map((c) => c.args[0].input.MaxNumberOfMessages);
    // Two free slots at first, then only the one freed by fast-1.
    expect(asked.slice(0, 2)).toEqual([2, 1]);
    expect(sqs.commandCalls(DeleteMessageCommand)).toHaveLength(3);
  });
});
