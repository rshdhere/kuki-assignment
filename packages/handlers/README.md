# Handlers

`@kuki/handlers`: business logic: the use cases the server performs, independent of HTTP.

> Scaffolded with `bun init`. `src/index.ts` is still empty.

## What goes here

- Functions like `createEvidence(input)` that coordinate `@kuki/drizzle` queries and services (`@kuki/s3`, `@kuki/sqs`, `@kuki/email`)
- Domain rules and error cases

## What doesn't

- Express `req`/`res` objects. Handlers take plain inputs so they can be unit tested and reused (e.g. from SQS consumers)
- Route wiring (`@kuki/api`)

## Usage

```ts
import { createEvidence } from "@kuki/handlers/evidence";

const created = await createEvidence({ title, fileKey });
```

Add modules under `src/` and import them by subpath (`@kuki/handlers/<file>`), or re-export them from `src/index.ts`.

## Scripts

```sh
bun run lint         # ESLint
bun run check-types  # tsc --noEmit
```
