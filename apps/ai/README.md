# AI service

Python service (FastAPI, OpenAI Responses API) that does the AI side of KuKi: document extraction, evidence-based answers, Indian financial-year totals, and the eval suite. The TypeScript worker and server call it over HTTP; Postgres stays owned by `@kuki/drizzle`, so this service is stateless.

```
worker ──POST /extract {bucket, key}──▶ ai ──GetObject──▶ S3
                                          └─ parse → extract (LLM) → verify → facts + segments
server ──POST /ask {question, documents}──▶ ai ── LLM with tools (calculate, financial_year_totals)
                                                 └─ verify quotes, re-evaluate calculations
server ──POST /financial-year──▶ ai (deterministic, no LLM)
server ──GET /evaluations──▶ ai (saved eval runs)
```

## How it works

### 1. Parsing keeps locations (`parsing.py`)

- **PDF**: one segment per page, text taken in visual reading order (PyMuPDF `sort=True`). Pages with almost no text layer are treated as scans, rendered to PNG and sent to the model as images.
- **XLSX/CSV**: cells rendered as `F16=2425123 (formula =SUM(F3:F14))`, in blocks of 60 rows, with the raw cell values kept. Formulas are shown because a hard-coded total and a `SUM` can disagree, which is exactly what reviewers need to see.

Each segment has a locator (`{page}` or `{sheet, cell_range}`), and is stored by the server so answers can be grounded and checked later.

### 2. Extraction (`extraction.py`)

One structured-output call per document returns the document type, organisation, period, summary, issues, and a list of facts. Each fact has a key, label, category, metric, series, value as written and as a number, unit, period, and a **source with a verbatim quote**.

The prompt asks for what reporting needs per document type: every payable amount kept separate with its due date, units as printed (kWh vs kVAh), every row of every series plus every total cell in workbooks, scope and commitments in policies, and dated entries in records. The model is told not to compute anything.

After the call, `grounding.verify` checks every fact: is the quote on the cited page (whitespace- and dash-insensitive), does the value appear there, or does the cited cell hold that value? Facts that don't check out are kept but marked `verified: false` and shown as **Unverified** in the dashboard.

Values the system derives (per-day consumption on bills) are added as separate facts with `origin: "calculated"` and a `derivation`, so **reported and calculated values never mix**.

### 3. Questions (`qa.py`)

The model gets, for each selected document, its extracted facts (with locations and verification status) and its full text by page or sheet block. It has two tools:

- `calculate(expression)`: exact arithmetic with a safe evaluator (`calc.py`), including sheet ranges such as `SUM('Monthly Summary 2026'!F3:F14)`, so totals over 12 seven-digit cells aren't left to the model's mental arithmetic.
- `financial_year_totals(fy, metric)`: the deterministic FY logic below.

The answer is structured: `status` (answered / partial / insufficient_evidence / conflicting_evidence), the answer text with `[E1]` citations, key values marked reported or calculated, calculations with expressions, evidence (document, page or cell range, verbatim quote), and gaps (assumptions, missing periods, inconsistencies).

Afterwards every evidence quote is verified against the cited location, and every calculation is **re-evaluated in Python** (`computed`, `matches`). The dashboard shows both checks.

### 4. Financial years (`fy.py`)

The Indian FY runs from 1 April to 31 March. `parse_fy` understands `FY 2024-25`, `2024-2025`, `FY 2024/25`, and `FY25` (read as the year ending March 2025, with the assumption stated). For a year, per document and series:

- dated quantity facts that overlap the year are selected;
- **finest grain wins**: monthly rows are kept and quarterly or annual totals overlapping them are excluded, with the reason listed, so nothing is counted twice;
- records crossing 1 April or 31 March are **prorated by days**, and this is flagged;
- coverage is reported as days covered and months covered or missing;
- values from **different or unnamed organisations, or different units, are never combined**;
- records for periods that haven't ended yet are flagged;
- money is only totalled when asked for (`metric=cost`), and then per amount type;
- only **reported** amounts in **additive units** count (energy, volume, mass, money). Calculated per-day figures, demand (kVA/kW), percentages, readings and statistics ("highest month") are left out;
- several entries with the same date are separate amounts (four waste loads on 10.03.2023 add up to 2.4 T);
- a figure the document restates (consumption, net consumption, the quantity an energy charge is billed on) is counted once, with the restatements listed.

Questions that mention a financial year get a hint to call the tool, so the model reports these numbers rather than inventing its own.

### Reliability

- The OpenAI SDK retries 429s, 5xx and connection errors with backoff (`OPENAI_MAX_RETRIES`).
- After that, errors are split: transient ones (rate limits, timeouts, 5xx, auth/config, S3 hiccups) return **503 `retryable: true`**, and the worker retries through SQS backoff. Permanent ones (unsupported or corrupt file, missing S3 object, a request the model rejects, output truncated) return **422 `retryable: false`**, and the worker fails the document at once instead of spending its 10 attempts.
- Extraction is idempotent: the server replaces a document's facts in one transaction.

## Evals

`evals/cases.yaml` holds 13 cases over the six documents. They cover bill consumption and periods, picking the right amount on a bill, kWh vs kVAh, meter-reading arithmetic, waste totals, an internal date inconsistency, workbook totals that disagree, a policy that doesn't state something, and FY coverage within one organisation and across two. Each case has the question, the documents in scope, the expected values, where in the documents they come from, and machine-checkable expectations.

`kuki-eval` runs the real pipeline end to end on the files in `data/documents/`: parse, extract, answer, score. Extractions are cached per pipeline and file hash. Four checks are scored per case (`evals/scoring.py`):

| Check       | Passes when                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| answer      | status allowed; expected numbers present; the asked-for figure comes first; no forbidden figure; required mentions present |
| evidence    | every expected page or cell range is cited by **verified** evidence, and at least 80% of all citations verify              |
| calculation | a calculation that re-evaluates correctly produces the expected value                                                      |
| uncertainty | gaps or limits are stated where the case needs them                                                                        |

A case is **pass** if every applicable check passes, **partial** if only the answer check passes, and **fail** otherwise. Results, including each answer, go to `evals/results/<pipeline>.json`. `kuki-eval compare` writes `comparison.json` and `comparison.md`, and the dashboard's Evaluation page shows them.

```sh
uv run kuki-eval run --pipeline baseline          # all cases
uv run kuki-eval run --pipeline baseline --only E02,E03
uv run kuki-eval run --pipeline improved
uv run kuki-eval compare baseline improved
```

Pipelines are named variants in `pipeline.py`, so the baseline stays reproducible next to the improved version.

## Eval results: baseline → improved

Both runs use `gpt-5.5` on the same 13 cases, each with a fresh extraction. Per-case answers and scores are in [`evals/results/baseline.json`](evals/results/baseline.json) and [`improved.json`](evals/results/improved.json), and the side-by-side table is in [`comparison.md`](evals/results/comparison.md).

|                               | baseline   | improved   |
| ----------------------------- | ---------- | ---------- |
| Score (pass = 1, partial = ½) | 88%        | 100%       |
| Pass / partial / fail         | 10 / 3 / 0 | 13 / 0 / 0 |
| Answer correct                | 13/13      | 13/13      |
| Evidence supports             | 10/13      | 13/13      |
| Calculation                   | 3/3        | 3/3        |
| Gaps stated                   | 6/6        | 6/6        |
| Answer citations verified     | 28/35      | 33/33      |
| Extracted facts verified      | 260/339    | 329/332    |

### The weakness

The baseline answered every case correctly. It found the payable amount among four Adani figures, chose kWh over kVAh on the BESCOM bill, flagged the workbook's three disagreeing annual totals (2,426,123 summed vs 2,425,123 in F16 vs 2,427,123 in Quarterly G7), stated FY 2026-27 coverage as April to December only, and kept the two organisations' bills apart in FY 2024-25.

But it **rejected correct evidence**, so a reviewer would see **Unverified** on citations that were right. That cost three cases (E09, E10, E11) and left 79 extracted facts unverified. There were three causes:

1. The model quotes spreadsheet evidence the way it sees the sheet (`A16=ANNUAL TOTAL | B16=1533290 | … F16=2425123`) over a range, and the verifier compared that whole string with single cell values. **0 of 8 sheet citations verified.**
2. Some workbook cells hold numbers stored as text (`'1533290'`, `'34.0%'` on the Source-wise and percentage columns), so numeric matching never fired. **71 of 113 workbook facts were unverified.**
3. Page 3 of the Nestlé policy is laid out in two columns, which come out interleaved line by line, so a correct quote from one column isn't contiguous in the page text.

### The improvement

The `improved` pipeline (`structured_evidence=True`) changes only how evidence is checked, in `grounding.verify`:

- `REF=value` quotes are split into cells, and **each** quoted cell must be inside the cited range and hold the quoted value. One wrong cell fails the whole quote.
- Numbers stored as text are compared as numbers, and amounts printed with a sign (BESCOM's `-8,777.32` off-peak credit) match.
- A multi-line quote passes when **every** line appears on the page, and at least one line has three or more words.

The rules are stricter in one respect. Unit tests showed the old numeric tolerance (relative 1e-6) treated 1,533,291 as equal to 1,533,290. It is now a fixed ±0.005, shared by both pipelines; the saved baseline run predates this tightening. Calculations still accept a stated result that is the exact value rounded to the digits the model gave.

### What improved, what regressed, what remains

- **Improved:** E09, E10 and E11 went from partial to pass. All five newly verified citations were confirmed by the new rules (three sheet ranges of 54–140 cells, every cell matching, and two policy quotes found line by line), not by the model answering differently: the baseline answers were already correct.
- **Regressed:** nothing at the case level. Both runs extract afresh, so small run-to-run differences exist (339 vs 332 reported facts), but no case got worse.
- **Unresolved:**
  - **Citations are correct but not precise.** E09 cites `Monthly Summary 2026!A2:J16` (140 cells) rather than F16 and Quarterly G7, and the scorer accepts any overlapping range. The next step would be asking for minimal cell ranges and scoring citation precision.
  - **A permissive rule remains from the baseline.** 3 citations pass via "quote paraphrased; its numbers appear on the page", which shouldn't count as verification.
  - **Five facts are still unverified, correctly:** three Adani quotes stitched from a header and a value on different lines, a policy quote flattened onto one line, and a number inside a sentence in a text cell.
  - **Only 13 cases.** 100% on 13 cases says the known failure modes are handled, not that the system is finished. Scanned pages (BESCOM p.2), amounts that need page images to tell apart, and larger document sets aren't covered.

### Regression check after live testing

Testing the live stack with the real documents turned up problems the 13 cases didn't measure:

- **FY totals:** the selection above counted calculated and non-additive figures, prorated annual totals into the year, and kept only one of four same-day waste entries.
- **Worker:** it processed messages one batch at a time, so a 150-second spreadsheet held up everything queued behind it.

Both were fixed (`fy.py`, and `runConsumer` with `WORKER_CONCURRENCY`). The full suite was then rerun on the `improved` pipeline and saved separately in [`evals/results/checks/improved-after-fy-fixes.json`](evals/results/checks/improved-after-fy-fixes.json), so the baseline→improved comparison above stays a single-change experiment.

That rerun first scored 11 pass / 1 partial / 1 fail. Both failures were the **scorer** being too rigid, not wrong answers:

- E03 listed the due date before the ₹6,31,510 amount, and the "primary figure" check read the first key value even when it wasn't a number.
- E12 cited the Adani consumption on page 2, whose consumption table also prints "Consumption (kWh) 47407" ((4132.27 − 3539.68) × MF 80).

The scorer now uses the first numeric key value, and sources can list every page that states a value. **All saved runs were rescored from their stored answers** with the same scorer (`kuki-eval rescore`): baseline 88%, improved 100%, regression check 100%.

## Known limitations

- Scanned pages are read from images, so their quotes can't be machine-checked (shown as unverified with that reason).
- Document text is sent whole while it fits (about 60k tokens across the selection); beyond that, segments are ranked by keyword overlap, which is crude retrieval.
- Extraction quality depends on the model. The verification flags errors but doesn't correct them.
- FY proration assumes even consumption across a billing period.
- Organisations are matched by normalised name only, so "J Kumar MEPL JV" and "J. Kumar MEPL (JV)" would be treated as different.
- The eval checks are string- and number-based. They catch wrong figures and missing citations, but not a well-cited answer with wrong reasoning in prose.

## Setup

```sh
cp .env.example .env     # OPENAI_API_KEY, OPENAI_MODEL, AWS credentials
uv sync
uv run uvicorn kuki_ai.app:app --reload --port 8000   # or `bun run dev` from the repo root
uv run pytest            # unit tests, no network
```

| Variable                  | Description                                                     |
| ------------------------- | --------------------------------------------------------------- |
| `OPENAI_API_KEY`          | Required for extraction and answers                             |
| `OPENAI_MODEL`            | Responses API model with structured outputs (default `gpt-5.5`) |
| `OPENAI_REASONING_EFFORT` | Optional, reasoning models only                                 |
| `OPENAI_TIMEOUT_S`        | Per-call timeout (default 180)                                  |
| `OPENAI_MAX_RETRIES`      | SDK retries on 429/5xx (default 3)                              |
| `AWS_REGION`, credentials | For reading uploads from S3                                     |

## Files

- `src/kuki_ai/app.py`: HTTP API and error mapping
- `parsing.py`, `grounding.py`, `calc.py`: parsing, verification, exact arithmetic
- `extraction.py`, `qa.py`, `fy.py`: extraction, answers, financial years
- `llm.py`: OpenAI calls and the transient/permanent split
- `pipeline.py`: named variants for evals
- `evals/run.py`, `evals/scoring.py`: the eval runner and scoring
- `evals/cases.yaml`, `evals/results/`: cases and saved runs
