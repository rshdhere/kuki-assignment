# UI

`@kuki/ui`: shared React components and utilities for `apps/client`.

## Contents

| Import               | Export   | Description                                      |
| -------------------- | -------- | ------------------------------------------------ |
| `@kuki/ui/button`    | `Button` | Client-side button (from the starter)            |
| `@kuki/ui/card`      | `Card`   | Link card (from the starter)                     |
| `@kuki/ui/code`      | `Code`   | Inline `<code>` wrapper (from the starter)       |
| `@kuki/ui/lib/utils` | `cn`     | Merge class names with `clsx` + `tailwind-merge` |

## Usage

```tsx
import { Button } from "@kuki/ui/button";
import { cn } from "@kuki/ui/lib/utils";

<Button appName="client" className={cn("px-4", isActive && "font-bold")}>
  Open
</Button>;
```

## Adding components

- Put components in `src/<name>.tsx`. They're exported automatically as `@kuki/ui/<name>`
- Put non-component helpers in `src/lib/<name>.ts`, exported as `@kuki/ui/lib/<name>`
- Import other files in this package by package name (`@kuki/ui/...`), not relative paths. ESLint enforces this

## Scripts

```sh
bun run lint         # ESLint
bun run check-types  # tsc --noEmit
```
