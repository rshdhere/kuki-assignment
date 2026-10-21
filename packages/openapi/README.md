# OpenAPI

`@kuki/openapi`: the hand-written OpenAPI 3.1 spec for the server.

## Files

- `openapi.yaml`: the spec. Edit it by hand.
- `src/index.ts`: exports `openApiSpecPath`, the absolute path to `openapi.yaml`.

## How it's served

`apps/server` serves this file at runtime:

- `GET /openapi.yaml` returns the raw spec
- `GET /docs` shows Swagger UI built from it

The server reads the file on each request, so saved edits show up when you refresh `/docs`. No restart needed.

## Usage

```ts
import { openApiSpecPath } from "@kuki/openapi";

res.type("application/yaml").sendFile(openApiSpecPath);
```

## Conventions

- Document every route in `@kuki/api` here
- Give every operation an `operationId` and `tags`
- Put reusable schemas under `components/schemas` and reference them with `$ref`

## Scripts

```sh
bun run lint         # ESLint
bun run check-types  # tsc --noEmit
```
