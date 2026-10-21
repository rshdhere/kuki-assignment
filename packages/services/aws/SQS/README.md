# SQS

`@kuki/sqs`: [Amazon SQS](https://aws.amazon.com/sqs/) client for message queues.

## AWS resources

Queues live in **Asia Pacific (Mumbai) `ap-south-1`**. Each environment has a main queue for document extraction jobs and a dead-letter queue (DLQ) for jobs that keep failing.

| Environment | Main queue                      | Dead-letter queue                   |
| ----------- | ------------------------------- | ----------------------------------- |
| Dev         | `kuki-document-extraction-dev`  | `kuki-document-extraction-dev-dlq`  |
| Prod        | `kuki-document-extraction-prod` | `kuki-document-extraction-prod-dlq` |

| Setting            | Main queue                      | DLQ      |
| ------------------ | ------------------------------- | -------- |
| Type               | Standard                        | Standard |
| Encryption         | SSE-SQS                         | SSE-SQS  |
| Visibility timeout | 5 minutes                       | Default  |
| Message retention  | 4 days                          | 14 days  |
| Receive wait time  | 20 seconds (long polling)       | Default  |
| Redrive            | To the DLQ after **3** receives | n/a      |

```
server ──send──▶ kuki-document-extraction-<env> ──receive──▶ worker
                          │
                 fails 3 times
                          ▼
                kuki-document-extraction-<env>-dlq   (inspect, fix, redrive)
```

After fixing the cause of a failure, use **Start DLQ redrive** on the DLQ in the SQS console to move the messages back to the main queue.

![SQS console showing the dev and prod queues with their dead-letter queues](docs/queues.png)

## Usage

```ts
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { sqs } from "@kuki/sqs";

await sqs.send(
  new SendMessageCommand({
    QueueUrl: process.env.QUEUE_URL,
    MessageBody: JSON.stringify({ type: "evidence.created", id }),
  }),
);
```

## Files

- `src/client.ts`: the shared `SQSClient` instance
- `src/index.ts`: public exports

Put producers and consumers in their own files under `src/` and re-export them from `src/index.ts`.

## Environment

| Variable     | Description                   |
| ------------ | ----------------------------- |
| `AWS_REGION` | Region the client connects to |

Credentials come from the default AWS provider chain: `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` env vars, a shared profile, or an IAM role.

## Scripts

```sh
bun run lint         # ESLint
bun run check-types  # tsc --noEmit
```
