# KuKi Evidence Dashboard

![Walkthrough of the KuKi evidence dashboard](docs/introduction.gif)

## API documentation

[Swagger UI](https://kuki-assignment.vercel.app/docs/)

[![Swagger UI showing the KuKi Evidence API uploads and documents endpoints](docs/swagger-uploads-documents.png)](https://kuki-assignment.vercel.app/docs/)

## AWS infrastructure

### S3

![S3 console showing the dev and prod buckets in ap-south-1](packages/services/aws/S3/docs/buckets.png)

### SQS

![SQS console showing the dev and prod queues with their dead-letter queues](packages/services/aws/SQS/docs/queues.png)

## Worker deployment

The worker Dockerfile lives in `docker/Dockerfile.worker`. Vercel uses the
Dockerfile directory as its build context, so CI runs
`bash scripts/prepare-worker-build.sh` before deployment to stage a copy at the
repository root. Run the same command before a manual Vercel deployment.

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

## Design

Figma: [KuKi Evidence Dashboard](https://www.figma.com/design/mGmLPlKGNmLxhDSSjATCYs/KuKi-%E2%80%94-Dashboard?node-id=0-1&t=3zGa5UCzS8nvLtiX-1)

[![Figma screens: Documents, Extracted facts, Ask, Financial year and Evaluation](docs/figma-screens.png)](https://www.figma.com/design/mGmLPlKGNmLxhDSSjATCYs/KuKi-%E2%80%94-Dashboard?node-id=0-1&t=3zGa5UCzS8nvLtiX-1)
