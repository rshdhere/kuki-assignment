# Controllers

`@kuki/controllers`: Express request handlers: the HTTP layer between routes and business logic.

## What goes here

- Functions with the `(req, res, next)` signature used by routers in `@kuki/api`
- Reading params/body, calling `@kuki/handlers`, and shaping the HTTP response and status codes

## What doesn't

- Business rules or database access. Delegate to `@kuki/handlers`
- Input schemas (`@kuki/validators`)

## Usage

```ts
import { listEvidence } from "@kuki/controllers/evidence";

router.get("/", listEvidence);
```

Add modules under `src/` and import them by subpath (`@kuki/controllers/<file>`), or re-export them from `src/index.ts`.

## Scripts

```sh
bun run lint         # ESLint
bun run check-types  # tsc --noEmit
```
