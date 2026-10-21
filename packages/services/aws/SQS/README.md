# SQS

`@kuki/sqs`: [Amazon SQS](https://aws.amazon.com/sqs/) client for message queues.

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
