# Config

`@kuki/config`: typed, validated runtime configuration for the server.

> Scaffolded with `bun init`. `src/index.ts` is still empty.

## What goes here

- Reading `process.env` once, validating it, and exporting a typed config object
- Defaults for local development (ports, regions, feature flags)

## What doesn't

- Secrets committed to the repo. Use `.env` files (gitignored) or the deployment environment
- Service clients (`@kuki/s3`, `@kuki/sqs`, `@kuki/email`)

## Usage

```ts
import { config } from "@kuki/config";

app.listen(config.port);
```

Add modules under `src/` and import them by subpath (`@kuki/config/<file>`), or re-export them from `src/index.ts`.

Any new env var also needs to be added to the `env` list of the relevant task in `turbo.json`. Turborepo's strict mode hides undeclared variables.

## Scripts

```sh
bun run lint         # ESLint
bun run check-types  # tsc --noEmit
```
