# API

`@kuki/api`: Express routers that define the server's HTTP routes.

> Scaffolded with `bun init`. `src/index.ts` is still empty.

## What goes here

- One router per resource (e.g. `src/evidence.ts`) mapping paths and methods to controllers
- Route-level middleware such as request validation from `@kuki/validators`

## What doesn't

- Request/response logic (`@kuki/controllers`)
- Business logic (`@kuki/handlers`)
- The OpenAPI spec (`@kuki/openapi`)

## Usage

```ts
import { evidenceRouter } from "@kuki/api/evidence";

app.use("/evidence", evidenceRouter);
```

Add modules under `src/` and import them by subpath (`@kuki/api/<file>`), or re-export them from `src/index.ts`.

Every route added here should also be documented in `packages/openapi/openapi.yaml`.

## Scripts

```sh
bun run lint         # ESLint
bun run check-types  # tsc --noEmit
```
