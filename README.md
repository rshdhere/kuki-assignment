# KuKi Evidence Dashboard

## Design

Figma: [KuKi Evidence Dashboard](https://www.figma.com/design/BeooUKNEH8gXROC1TbMWEW/KuKi-Evidence-Dashboard?node-id=0-1&t=u0fQz3JjLMVKChmv-1)

## Structure

- `apps/web`: Next.js app
- `apps/docs`: Next.js app
- `packages/ui`: shared React components and utilities (`@repo/ui`)
- `packages/eslint-config`: shared ESLint config (`@repo/eslint-config`)
- `packages/typescript-config`: shared tsconfigs (`@repo/typescript-config`)

## Getting started

```sh
bun install
bun run dev
```

## Scripts

| Command               | Description                      |
| --------------------- | -------------------------------- |
| `bun run dev`         | Start all apps in dev mode       |
| `bun run build`       | Build all apps and packages      |
| `bun run lint`        | Lint all apps and packages       |
| `bun run check-types` | Type-check all apps and packages |
| `bun run format`      | Format the repo with Prettier    |
