# KuKi Evidence Dashboard

## Design

Figma: [KuKi Evidence Dashboard](https://www.figma.com/design/BeooUKNEH8gXROC1TbMWEW/KuKi-Evidence-Dashboard?node-id=0-1&t=u0fQz3JjLMVKChmv-1)

[![Figma screens: Documents, Extracted facts, Ask, Financial year and Evaluation](docs/figma-screens.png)](https://www.figma.com/design/BeooUKNEH8gXROC1TbMWEW/KuKi-Evidence-Dashboard?node-id=0-1&t=u0fQz3JjLMVKChmv-1)

## Structure

- `apps/client`: Next.js frontend
- `apps/server`: Bun + Express backend (Swagger UI at `/docs`, spec at `/openapi.yaml`)
- `apps/worker`: SQS consumer for document extraction jobs
- `apps/ai`: Python (FastAPI + OpenAI) service for extraction, evidence-based answers, financial-year totals and the eval suite. See [its README](apps/ai/README.md) for the approach, design choices and limitations
- `packages/openapi`: hand-written OpenAPI spec (`openapi.yaml`, `@kuki/openapi`)
- `packages/api`, `config`, `controllers`, `drizzle`, `handlers`, `types`, `validators`: server-side packages (`@kuki/<name>`)
- `packages/drizzle`: Postgres schema, client and migrations (`@kuki/drizzle`)
- `compose.yaml`: local Postgres
- `packages/services/aws/S3`: S3 client (`@kuki/s3`)
- `packages/services/aws/SQS`: SQS client (`@kuki/sqs`)
- `packages/services/email`: Resend client (`@kuki/email`)
- `packages/services/ai`: HTTP client for `apps/ai` (`@kuki/ai`)
- `packages/ui`: shared React components and utilities (`@kuki/ui`)
- `tests/integration`: Vitest + Supertest integration tests against the server
- `tests/e2e`: Playwright end-to-end tests against the client
- `tooling/eslint-config`: shared ESLint config (`@kuki/eslint-config`)
- `tooling/typescript-config`: shared tsconfigs (`@kuki/typescript-config`)

## AWS infrastructure

### S3

![S3 console showing the dev and prod buckets in ap-south-1](packages/services/aws/S3/docs/buckets.png)

### SQS

![SQS console showing the dev and prod queues with their dead-letter queues](packages/services/aws/SQS/docs/queues.png)

## Upload pipeline

```
browser ──1. POST /uploads {files}──────────────▶ server   presigns a PUT per file
browser ──2. PUT file (signed headers)──────────▶ S3       uploads/<uploadId>
browser ──3. POST /uploads/:id/complete─────────▶ server ──HeadObject──▶ S3
                                                     └──SendMessage──▶ SQS ──▶ worker
```

1. The client hashes each file (SHA-256) and asks for presigned URLs. Files must be PDF, XLSX or CSV, up to 25 MB, at most 20 per request. The server records a document per file in Postgres. Files whose content is already in the system come back as duplicates and are never uploaded.
2. The browser PUTs each file straight to S3. Size, type, filename and hash are signed, so S3 rejects anything that differs from what was declared.
3. The server checks the object exists, marks the document queued and sends the job. Completing twice doesn't queue twice. The worker records each attempt, deletes the message on success, and skips redelivered jobs for documents that are already done. Failures are retried with backoff and go to the DLQ after 10 attempts.

## Extraction and questions

```
SQS ──▶ worker ──POST /extract──▶ ai ──▶ S3 file → pages / cells → LLM facts with quotes → verified
          └─ one transaction: facts + segments + document fields + succeeded

dashboard ──POST /answers──▶ server ──facts + segments──▶ ai /ask ──▶ answer + checked evidence ──▶ answers table
dashboard ──GET /financial-year──▶ server ──▶ ai /financial-year (deterministic totals + coverage)
```

- Every fact keeps its page or sheet!range and a verbatim quote, and is checked against the document text after extraction. Values the system derives are stored separately as `calculated`.
- Answers cite evidence by location. Quotes are verified and every calculation is re-evaluated in Python, and both checks are shown.
- Financial-year totals use the finest-grained records, prorate across 1 April and 31 March, report month coverage, and never add up different organisations or units.
- Temporary AI failures are retried through SQS backoff. Files that can never be processed fail at once.

Every status change is kept in `document_events` and served at `GET /events`. Documents are listed at `GET /documents`. See [`@kuki/drizzle`](packages/drizzle/README.md) for the tables and status flow. Before uploading against real AWS, set up bucket CORS and IAM as described in [`@kuki/s3`](packages/services/aws/S3/README.md).

## Getting started

Needs Docker for the local Postgres, [Bun](https://bun.sh), and [uv](https://docs.astral.sh/uv/) for the Python service.

```sh
bun install
(cd apps/ai && uv sync)
bun run db:up                                  # Postgres on localhost:5432
bun run db:seed                                # create the databases and migrate them
cp apps/server/.env.example apps/server/.env   # fill in the queue URL and credentials
cp apps/worker/.env.example apps/worker/.env
cp apps/ai/.env.example apps/ai/.env           # OPENAI_API_KEY, AWS credentials
bun run dev                                    # client :3000, server :4000, ai :8000, worker
```

Open http://localhost:3000, upload the documents, and follow them on the Documents page. Then use Extracted facts, Ask, Financial year and Evaluation. The API is documented at http://localhost:4000/docs.

### Evals

Put the six assignment documents in `data/documents/`, then:

```sh
cd apps/ai
uv run kuki-eval run --pipeline baseline
uv run kuki-eval run --pipeline improved
uv run kuki-eval compare baseline improved   # writes evals/results/comparison.md
```

Cases, scoring and saved results are described in [apps/ai/README.md](apps/ai/README.md#evals).

Without `AWS_SQS_QUEUE_URL` the worker exits on start and the rest of the app still runs. The client calls the API at `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`).

## Scripts

| Command               | Description                                             |
| --------------------- | ------------------------------------------------------- |
| `bun run dev`         | Start all apps in dev mode                              |
| `bun run build`       | Build all apps and packages                             |
| `bun run lint`        | Lint all apps and packages                              |
| `bun run check-types` | Type-check all apps and packages                        |
| `bun run test`        | Integration tests (needs `db:up`) and Python unit tests |
| `bun run db:up`       | Start the local Postgres                                |
| `bun run db:down`     | Stop the local Postgres                                 |
| `bun run db:generate` | Generate a migration from the schema                    |
| `bun run db:migrate`  | Apply migrations                                        |
| `bun run db:seed`     | Create missing databases and migrate them               |
| `bun run db:studio`   | Open Drizzle Studio                                     |
| `bun run test:e2e`    | Run Playwright end-to-end tests                         |
| `bun run format`      | Format the repo with Prettier                           |

Before the first e2e run, install the browser: `cd tests/e2e && bunx playwright install chromium`.
