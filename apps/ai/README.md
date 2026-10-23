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

For native Harbor tasks and the KuKi pipeline adapter, see
[Harbor evaluations](evals/harbor/README.md). The exporter uses the same 13 cases
and scoring rules; historical baseline and improved runs remain available below.

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

Pipelines are named variants in `pipeline.py`. The baseline retains one-pass answering; saved pre-fix runs preserve the earlier prompt/version behavior for the before/after comparison.

## Eval results: baseline → improved

The latest dashboard comparison uses real fresh-extraction runs on the same 13
cases and unchanged scoring thresholds. The pre-fix baseline is saved in
[`evals/results/baseline.json`](evals/results/baseline.json); the post-fix run is
[`improved.json`](evals/results/improved.json). Each includes individual answers,
source references, scores and extraction summaries. See the
[case comparison](evals/results/comparison.md).

| Check                     | Before fixes    | Improved     |
| ------------------------- | --------------- | ------------ |
| Weighted score            | 80.8% (10.5/13) | 100% (13/13) |
| Pass / partial / fail     | 9 / 3 / 1       | 13 / 0 / 0   |
| Answer                    | 12/13           | 13/13        |
| Evidence                  | 10/13           | 13/13        |
| Calculation               | 3/3             | 3/3          |
| Uncertainty               | 6/6             | 6/6          |
| Verified answer citations | 21/27           | 33/33        |

### Weakness and targeted improvements

Fresh testing exposed two weaknesses beyond the original structured-verification
change: a payment answer treated the bill's accounting total as a competing
payment instruction (E03), and a policy answer quoted broad passages that did
not all verify (E10). Workbook and financial-year citations also failed in the
baseline (E09, E11).

The improved pipeline retains cell-by-cell spreadsheet verification and
line-by-line matching for multi-column pages. It now gives the model the
verifier's actual failed citation/calculation checks and allows up to two repair
rounds. Checks and the 80% evaluation evidence threshold are unchanged. Invalid
support that remains is shown as unverified, the answer cannot remain fully
answered, and the missing support is stated in its gaps. The model never sees
eval expectations. Payment instructions ask it to select the payment summary
for the requested conditions and explain accounting or rounding differences
separately, without embedding any assignment-document values.

### What improved, regressed, and remains

E03, E09, E10 and E11 improve to pass; the other nine cases stay pass. There are
no case-level regressions in this comparison. Each run extracted all six
supplied documents afresh. These are before/after system measurements, not an
isolated experiment: extraction and answering are stochastic, and prompt and
repair changes accompany structured verification.

The previous legacy comparison is preserved under `evals/results/checks/` as
`pre-completion-{baseline,improved,comparison}.json` snapshots. Harbor's earlier 88.5% →
88.5% rerun and its failure analysis remain in `evals/harbor/assessment.md`.
Intermediate audit runs, including failures and a cached-extraction 100% run,
are also retained; the dashboard's canonical files use fresh extraction.

A 13-case 100% is regression evidence, not general correctness. Broad ranges
can still satisfy the scorer's overlapping-cell rule, numeric-only matching
remains permissive, scanned pages need visual review, and prose reasoning is
not independently judged. Larger documents and repeated runs need more coverage.

## Known limitations

- Scanned pages are read from images, so their quotes can't be machine-checked (shown as unverified with that reason).
- Document text is sent whole while it fits (about 60k tokens across the selection); beyond that, segments are ranked by keyword overlap, which is crude retrieval.
- Extraction quality depends on the model. Answer verification requests bounded repairs, but unresolved errors still need review.
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
