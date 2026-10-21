# Types

`@kuki/types`: TypeScript types shared across the client, server and packages.

> Scaffolded with `bun init`. `src/index.ts` is still empty.

## What goes here

- Domain and DTO types used on both sides of the API
- Shared enums and utility types

## What doesn't

- Runtime code. This package should only export types
- Database row types that can be inferred from `@kuki/drizzle`

## Usage

```ts
import type { Evidence } from "@kuki/types/evidence";
```

Add modules under `src/` and import them by subpath (`@kuki/types/<file>`), or re-export them from `src/index.ts`.

## Scripts

```sh
bun run lint         # ESLint
bun run check-types  # tsc --noEmit
```
