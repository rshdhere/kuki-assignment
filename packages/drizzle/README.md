# Drizzle

`@kuki/drizzle`: database access with [Drizzle ORM](https://orm.drizzle.team): schema, client and migrations.

> Scaffolded with `bun init`. `src/index.ts` is still empty.

## What goes here

- Table definitions (`src/schema/*.ts`)
- The database client instance
- Migrations and `drizzle.config.ts`

## What doesn't

- Business logic built on top of queries (`@kuki/handlers`)
- Hand-written API types. Infer them from the schema with `$inferSelect` / `$inferInsert`

## Usage

```ts
import { db } from "@kuki/drizzle";
import { evidence } from "@kuki/drizzle/schema";

const rows = await db.select().from(evidence);
```

Add modules under `src/` and import them by subpath (`@kuki/drizzle/<file>`), or re-export them from `src/index.ts`.

Drizzle isn't installed yet. Add `drizzle-orm` and `drizzle-kit` to this package when the database is chosen.

## Scripts

```sh
bun run lint         # ESLint
bun run check-types  # tsc --noEmit
```
