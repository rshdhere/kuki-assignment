# Client

Next.js dashboard for the KuKi sustainability evidence workflow. It is the coded version of the [KuKi Evidence Dashboard](https://www.figma.com/design/BeooUKNEH8gXROC1TbMWEW) Figma file (Evergreen theme).

## Routes

| Route             | Screen           | What it shows                                                                        |
| ----------------- | ---------------- | ------------------------------------------------------------------------------------ |
| `/`               | Documents        | Upload, batch summary, processing queue with job states, activity and queue settings |
| `/facts`          | Extracted facts  | Facts for one document, reported vs calculated, source preview with the highlight    |
| `/ask`            | Ask              | An answer with citations, the calculation, sources and documents in scope            |
| `/financial-year` | Financial year   | Indian FY totals, month-by-month coverage, document coverage and assumptions         |
| `/evaluation`     | Evaluation       | Baseline vs improved runs, score by check, the schema change and the 12 cases        |

All screens share `app/(dashboard)/layout.tsx`, which renders the sidebar.

## Where things live

```text
app/
├── layout.tsx              # fonts (Geist, Geist Mono) and metadata
├── globals.css             # brand tokens, components, motion
└── (dashboard)/            # one folder per screen
components/
├── sidebar.tsx             # navigation, active state from the URL
├── motion-switch.tsx       # "Pause animations" (stops every loop)
├── facts-explorer.tsx      # origin filter + highlight that follows the picked fact
├── upload-button.tsx       # toast with a draining timer
├── copy-answer.tsx
├── evaluation-shell.tsx    # run state shared by the top bar and the page
├── icon.tsx                # Lucide paths, no icon dependency
└── ui.tsx                  # Badge, Status, StatCard and other small pieces
lib/
└── data.ts                 # sample data, read by hand from the six documents
```

## Data

`lib/data.ts` holds the values the screens show. Document figures (amounts, kWh, periods, cells) are real values from the assignment dataset. Job states and evaluation marks are example values until `apps/server` exposes the documents, facts, answers and eval results endpoints. Replace the imports in each page with fetches from the server when those exist.

## Design rules kept in code

- Yellow (`--mark`) only marks evidence: cited numbers, the source line, citation hover.
- Every button and control has default, hover, focus-visible, pressed and disabled states.
- Motion is 120–480 ms with ease-out. Loops only show live work, and "Pause animations" or the OS reduced-motion setting stops them.
- Status colours always come with an icon and a word.

## Scripts

```sh
bun run dev          # next dev on port 3000
bun run lint         # ESLint
bun run check-types  # next typegen && tsc --noEmit
```
