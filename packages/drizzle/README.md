# Drizzle

`@kuki/drizzle`: Postgres access with [Drizzle ORM](https://orm.drizzle.team): schema, client and migrations.

## Local database

Postgres 17 runs in Docker (`compose.yaml` at the repo root):

```sh
bun run db:up        # start Postgres on localhost:5432 (user/password/db: kuki)
bun run db:seed      # create kuki and kuki_test if missing, and migrate both
bun run db:down      # stop it (data stays in the postgres-data volume)
```

`kuki_test` is used by the integration tests, which empty its tables before every test. `src/seed.ts` is safe to re-run, and the tests' global setup calls the same functions, so `bun run test` works even if you haven't seeded.

## Tables

| Table             | What it holds                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `documents`       | One row per file the client asked to upload: upload facts, S3 location, pipeline status, attempts, and fields extraction fills in |
| `document_events` | Activity feed: one row per status change, with the attempt number                                                                 |

`documents.status` moves through:

```
awaiting_upload ──complete──▶ queued ──worker──▶ extracting ──▶ succeeded
       │                                            │  ▲
       │ same content queued first                  ▼  │ SQS redelivers
       └──────────────▶ duplicate               retrying ──(10th receive)──▶ failed
```

Files whose SHA-256 is already in the system are recorded straight away as `duplicate` and never uploaded. A partial unique index (`documents_sha256_original_idx`) allows at most one queued/extracting/retrying/succeeded document per hash, so two identical uploads racing each other can't both be queued.

## Changing the schema

1. Edit `src/schema/*.ts`
2. `bun run db:generate` writes a SQL migration to `migrations/`. Review it and commit it.
3. `bun run db:migrate` applies it

Column names are camelCase in TypeScript and snake_case in SQL (`casing: "snake_case"`). Name constraints and indexes explicitly so the camelCase doesn't leak into SQL names.

## Usage

```ts
import { db } from "@kuki/drizzle";
import { documents } from "@kuki/drizzle/schema";

const rows = await db.select().from(documents);
```

## Files

- `src/schema/`: table definitions
- `src/client.ts`: the `db` instance (postgres.js driver) and `isUniqueViolation`
- `src/migrate.ts`: `runMigrations` and the path to `migrations/`
- `src/seed.ts`: creates missing databases and migrates them (`bun run db:seed`, and the integration tests)
- `migrations/`: generated SQL migrations
- `drizzle.config.ts`: drizzle-kit config

## Environment

| Variable            | Description                                                                         |
| ------------------- | ----------------------------------------------------------------------------------- |
| `TEST_DATABASE_URL` | Database for the integration tests. Defaults to `DATABASE_URL`'s name plus `_test`. |
| `DATABASE_URL`      | Postgres connection string. Defaults to the compose.yaml database (`kuki`).         |

## Scripts

```sh
bun run db:generate  # drizzle-kit generate
bun run db:migrate   # drizzle-kit migrate (DATABASE_URL only)
bun run db:seed      # create + migrate kuki and kuki_test
bun run db:studio    # drizzle-kit studio
bun run lint         # ESLint
bun run check-types  # tsc --noEmit
```
