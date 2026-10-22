import { setTimeout as sleep } from "node:timers/promises";
import { PermanentExtractionError } from "@kuki/handlers/errors";
import {
  processExtractionJob,
  recordExtractionFailure,
} from "@kuki/handlers/extraction";
import {
  deleteMessage,
  receiveJson,
  setVisibility,
  type ReceivedMessage,
} from "@kuki/sqs";
import type { ExtractionJob } from "@kuki/types";

const isExtractionJob = (body: unknown): body is ExtractionJob =>
  typeof body === "object" &&
  body !== null &&
  (body as ExtractionJob).type === "document.uploaded" &&
  typeof (body as ExtractionJob).uploadId === "string";

/** Retry delay after a failed receive: 30 s, 60 s, 120 s, capped at 5 min. */
export const backoffSeconds = (receiveCount: number) =>
  Math.min(30 * 2 ** (receiveCount - 1), 300);

/**
 * Handles one message. On success it's deleted. On failure it stays on the
 * queue with a backoff, and the queue's redrive policy moves it to the DLQ
 * after 10 receives. A permanent failure (a file that can't be read) fails the
 * document and deletes the message, since retrying can't help. Malformed
 * bodies are never deleted, so they end up in the DLQ for inspection.
 */
export async function handleMessage(
  queueUrl: string,
  message: ReceivedMessage<unknown>,
) {
  const { messageId, receiptHandle, receiveCount, body } = message;
  if (!isExtractionJob(body)) {
    console.error(
      `[worker] ${messageId}: not an extraction job, leaving for the DLQ`,
    );
    return;
  }
  try {
    await processExtractionJob(body, receiveCount);
    await deleteMessage(queueUrl, receiptHandle);
  } catch (err) {
    const recorded = await recordExtractionFailure(
      body.uploadId,
      receiveCount,
      err,
    ).then(
      () => true,
      (e) => {
        console.error(`[worker] ${messageId}: could not record the failure`, e);
        return false;
      },
    );
    // Only drop the message once the failure is on record; otherwise let it retry.
    if (err instanceof PermanentExtractionError && recorded) {
      console.error(
        `[worker] ${messageId} (${body.uploadId}) failed permanently: ${err.message}`,
      );
      await deleteMessage(queueUrl, receiptHandle).catch((e) =>
        console.error(`[worker] ${messageId}: could not delete`, e),
      );
      return;
    }
    const delay = backoffSeconds(receiveCount);
    console.error(
      `[worker] ${messageId} (${body.uploadId}) failed on attempt ${receiveCount}, retrying in ${delay} s`,
      err,
    );
    await setVisibility(queueUrl, receiptHandle, delay).catch((e) =>
      console.error(`[worker] ${messageId}: could not set backoff`, e),
    );
  }
}

/** Jobs run at once. Extraction is mostly waiting on the AI service. */
export const DEFAULT_CONCURRENCY = 4;

/**
 * Long-polls the queue until `signal` aborts, then lets in-flight messages
 * finish. Keeps up to `concurrency` jobs running and asks for more as soon as
 * one finishes, so a slow document doesn't hold up the ones behind it.
 */
export async function runConsumer(
  queueUrl: string,
  signal: AbortSignal,
  concurrency = DEFAULT_CONCURRENCY,
) {
  const inFlight = new Set<Promise<void>>();
  const start = (message: ReceivedMessage<unknown>) => {
    const job = handleMessage(queueUrl, message)
      .catch((err) =>
        console.error(`[worker] ${message.messageId}: unexpected error`, err),
      )
      .finally(() => inFlight.delete(job));
    inFlight.add(job);
  };

  while (!signal.aborted) {
    if (inFlight.size >= concurrency) {
      await Promise.race(inFlight);
      continue;
    }
    let messages: ReceivedMessage<unknown>[];
    try {
      messages = await receiveJson<unknown>(queueUrl, {
        // SQS returns at most 10 per receive.
        max: Math.min(10, concurrency - inFlight.size),
        signal,
      });
    } catch (err) {
      if (signal.aborted) break;
      console.error("[worker] receive failed, retrying in 5 s", err);
      await sleep(5000);
      continue;
    }
    messages.forEach(start);
  }
  await Promise.all(inFlight);
}
