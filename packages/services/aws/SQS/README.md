# SQS

`@kuki/sqs`: [Amazon SQS](https://aws.amazon.com/sqs/) client for message queues.

## AWS resources

Queues live in **Asia Pacific (Mumbai) `ap-south-1`**. Each environment has a main queue for document extraction jobs and a dead-letter queue (DLQ) for jobs that keep failing.

| Environment | Main queue                      | Dead-letter queue                   |
| ----------- | ------------------------------- | ----------------------------------- |
| Dev         | `kuki-document-extraction-dev`  | `kuki-document-extraction-dev-dlq`  |
| Prod        | `kuki-document-extraction-prod` | `kuki-document-extraction-prod-dlq` |

| Setting            | Dev main queue                   | Prod main queue                  | DLQs (both)   |
| ------------------ | -------------------------------- | -------------------------------- | ------------- |
| Type               | Standard                         | Standard                         | Standard      |
| Encryption         | SSE-SQS                          | SSE-SQS                          | SSE-SQS       |
| Visibility timeout | 5 minutes                        | **30 seconds** ⚠️                | 30 seconds    |
| Message retention  | 4 days                           | 4 days                           | **4 days** ⚠️ |
| Receive wait time  | 20 seconds (long polling)        | 0 seconds¹                       | 0 seconds     |
| Redrive            | To the DLQ after **10** receives | To the DLQ after **10** receives | n/a           |

¹ Doesn't matter: the worker asks for 20-second long polling on every receive.

```
server ──send──▶ kuki-document-extraction-<env> ──receive──▶ worker
                          │
                 fails 10 times (~40 min with the worker's backoff)
                          ▼
                kuki-document-extraction-<env>-dlq   (inspect, fix, redrive)
```

### Settings to fix

- **Prod visibility timeout (30 s)**: a job that runs longer than 30 s becomes visible again and is picked up a second time while the first run is still going. Set it to 5 minutes to match dev.
- **DLQ retention (4 days)**: a message keeps its original enqueue time when it moves to the DLQ, so a job that took a while to fail can expire from the DLQ almost immediately. Set both DLQs to 14 days (the maximum).

After fixing the cause of a failure, use **Start DLQ redrive** on the DLQ in the SQS console to move the messages back to the main queue.

![SQS console showing the dev and prod queues with their dead-letter queues](docs/queues.png)

## Messages

Messages are JSON. The extraction queue carries `ExtractionJob` (`@kuki/types/uploads`), sent by `POST /uploads/:id/complete` and consumed by `apps/worker`.

## Usage

```ts
import { deleteMessage, receiveJson, sendJson } from "@kuki/sqs";

await sendJson(queueUrl, { type: "document.uploaded", uploadId /* … */ });

for (const m of await receiveJson<ExtractionJob>(queueUrl)) {
  // m.body is undefined if the message wasn't valid JSON
  await deleteMessage(queueUrl, m.receiptHandle);
}
```

`setVisibility(queueUrl, receiptHandle, seconds)` delays the next attempt of a failed message.

## Files

- `src/client.ts`: the shared `SQSClient` instance
- `src/messages.ts`: JSON send/receive, delete and visibility helpers
- `src/index.ts`: public exports

Put producers and consumers in their own files under `src/` and re-export them from `src/index.ts`.

## Environment

| Variable            | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `AWS_REGION`        | Region the client connects to                        |
| `AWS_SQS_QUEUE_URL` | URL of the main extraction queue (server and worker) |

Credentials come from the default AWS provider chain: `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` env vars, a shared profile, or an IAM role.

## Scripts

```sh
bun run lint         # ESLint
bun run check-types  # tsc --noEmit
```
