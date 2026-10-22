# Validators

`@kuki/validators`: runtime validation schemas for request input.

## What goes here

- Schemas for request bodies, params and query strings, one file per resource
- Express middleware that validates a request against a schema

## What doesn't

- Business rules that need the database (`@kuki/handlers`)
- Plain TypeScript types (`@kuki/types`). Infer them from the schemas where possible

## Usage

```ts
import { validate } from "@kuki/validators";
import { createEvidenceSchema } from "@kuki/validators/evidence";

router.post("/", validate(createEvidenceSchema), createEvidence);
```

Add modules under `src/` and import them by subpath (`@kuki/validators/<file>`), or re-export them from `src/index.ts`.

Schemas use [Zod](https://zod.dev).

## Scripts

```sh
bun run lint         # ESLint
bun run check-types  # tsc --noEmit
```
