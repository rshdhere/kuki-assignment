# Worker

Consumes the document extraction queue (`kuki-document-extraction-<env>`, see `@kuki/sqs`).

It long-polls SQS and hands each `document.uploaded` job to `processExtractionJob` in `@kuki/handlers/extraction`. That calls the Python AI service (`POST /extract`, see [`apps/ai`](../ai/README.md)), which reads the file from S3, classifies it and extracts facts tied to their page or cell range. The handler tracks the document's status in Postgres:

- **Success**: facts, page/sheet segments and the document fields are written in one transaction that replaces any earlier results, the document is marked `succeeded`, and the message is deleted.
- **Permanent failure**: the AI service says retrying can't help (unsupported or corrupt file, a request the model rejects). The document is marked `failed` with the error straight away and the message is deleted.
- **Already done**: a redelivered job for a document that's `succeeded` or a `duplicate` is skipped and deleted.
- **Temporary failure** (rate limit, timeout, AI service down): the document is marked `retrying` (or `failed` on the last attempt) with the error, and the message stays on the queue and becomes visible again after 30 s, 60 s, 120 s (capped at 5 min). After 10 receives (about 40 minutes) the queue's redrive policy moves it to the DLQ.
- **Malformed body**: the message is left alone and ends up in the DLQ for inspection.

A job that runs longer than the queue's visibility timeout (5 min in dev) is delivered again while still running. SQS also delivers at least once in general. The status check above keeps finished documents from being processed twice, but extraction itself should still be safe to re-run.

Every claim receives a unique token stored in Postgres. Results are committed
under a row lock only if that token still owns the document; failure updates
require the same token. An older worker cannot overwrite a newer extraction or
change its success back to retrying, including when duplicate deliveries have
the same receive count. The token is cleared on success or a recorded failure;
a restarted worker can claim an interrupted document without waiting on a dead
process. Apply database migration `0002_tough_meltdown.sql` before deploying the
updated worker (`bun run db:migrate` against the target database).
Production CI now applies pending migrations before deploying and checks the
live data endpoints afterward.

`SIGINT`/`SIGTERM` stop polling and let in-flight jobs finish.

## Environment

| Variable             | Description                                                                   |
| -------------------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL`       | Postgres connection string (defaults to the compose.yaml database)            |
| `AWS_REGION`         | Region of the queue                                                           |
| `AWS_SQS_QUEUE_URL`  | URL of the main extraction queue. The worker exits if it isn't set.           |
| `WORKER_CONCURRENCY` | Jobs processed at once (default 4); a slow document no longer blocks the rest |
| `AI_SERVICE_URL`     | Python AI service (default `http://localhost:8000`)                           |
| `AI_TIMEOUT_MS`      | Per-request timeout, kept under the visibility timeout (default 240000)       |

Copy `.env.example` to `.env`. Credentials come from the default AWS provider chain.

The worker's IAM identity needs `sqs:ReceiveMessage`, `sqs:DeleteMessage` and `sqs:ChangeMessageVisibility` on the queue. The AI service's identity needs `s3:GetObject` on `uploads/*`.

## Scripts

```sh
bun run dev          # watch mode
bun run start
bun run lint         # ESLint
bun run check-types  # tsc --noEmit
```
