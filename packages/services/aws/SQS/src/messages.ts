import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import { sqs } from "@kuki/sqs/client";

export interface ReceivedMessage<T> {
  messageId: string;
  receiptHandle: string;
  /** Times this message has been received, including this one. */
  receiveCount: number;
  body: T;
}

/** Sends `body` as JSON and returns the SQS message id. */
export async function sendJson(queueUrl: string, body: unknown) {
  const res = await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(body),
    }),
  );
  return res.MessageId;
}

/**
 * Long-polls for up to `max` messages. Bodies that aren't valid JSON are
 * returned with `body: undefined` so the caller decides what to do with them.
 */
export async function receiveJson<T>(
  queueUrl: string,
  {
    max = 10,
    waitSeconds = 20,
    signal,
  }: { max?: number; waitSeconds?: number; signal?: AbortSignal } = {},
): Promise<ReceivedMessage<T | undefined>[]> {
  const res = await sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: max,
      WaitTimeSeconds: waitSeconds,
      MessageSystemAttributeNames: ["ApproximateReceiveCount"],
    }),
    { abortSignal: signal },
  );
  return (res.Messages ?? []).flatMap((m) => {
    if (!m.MessageId || !m.ReceiptHandle) return [];
    let body: T | undefined;
    try {
      body = JSON.parse(m.Body ?? "") as T;
    } catch {
      body = undefined;
    }
    return [
      {
        messageId: m.MessageId,
        receiptHandle: m.ReceiptHandle,
        receiveCount: Number(m.Attributes?.ApproximateReceiveCount ?? 1),
        body,
      },
    ];
  });
}

export async function deleteMessage(queueUrl: string, receiptHandle: string) {
  await sqs.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
    }),
  );
}

/** Makes a message visible again after `seconds` (0 = immediately) instead of the queue default. */
export async function setVisibility(
  queueUrl: string,
  receiptHandle: string,
  seconds: number,
) {
  await sqs.send(
    new ChangeMessageVisibilityCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
      VisibilityTimeout: seconds,
    }),
  );
}
