# Harbor integration assessment

Harbor 0.24.0 was exercised locally through Docker: task export, image builds,
the KuKi adapter, real extraction and question-answering calls, verification,
artifact capture and collection into shareable results. Both full runs used the
same 13 generated tasks. This validates the evaluation integration, not the
dashboard, S3/SQS upload workflow or production reliability.

## Actual live results

| Measure                              |   Baseline |   Improved |
| ------------------------------------ | ---------: | ---------: |
| Completed trials                     |         13 |         13 |
| Execution exceptions                 |          0 |          0 |
| Pass / partial / fail                | 10 / 3 / 0 | 10 / 3 / 0 |
| Weighted score (pass 1, partial 0.5) |      88.5% |      88.5% |
| Answer checks                        |      13/13 |      13/13 |
| Evidence checks                      |      10/13 |      10/13 |
| Calculation checks                   |        3/3 |        3/3 |
| Uncertainty checks                   |        5/6 |        6/6 |
| Verified citations                   |      23/29 |      26/30 |
| Job wall time                        |    20m 50s |    17m 00s |

The jobs ran concurrently with two trials per job. Wall time includes container
setup, fresh extraction per task and model calls. It is not a controlled latency
benchmark, and the difference should not be attributed to the verifier change.

| Case | Coverage                                   | Baseline | Improved |
| ---- | ------------------------------------------ | -------- | -------- |
| E01  | Adani consumption and period               | pass     | pass     |
| E02  | BESCOM kWh versus kVAh                     | pass     | pass     |
| E03  | Adani due-date payable amount              | pass     | pass     |
| E04  | BESCOM net payable amount                  | pass     | pass     |
| E05  | Water meter arithmetic                     | pass     | pass     |
| E06  | Water total due and GST                    | pass     | pass     |
| E07  | Waste quantity total                       | pass     | pass     |
| E08  | Conflicting waste-record dates             | pass     | pass     |
| E09  | Workbook monthly and annual reconciliation | partial  | partial  |
| E10  | Complaint deadline absent from policy      | partial  | partial  |
| E11  | FY 2026-27 total and missing months        | partial  | partial  |
| E12  | Separate organisations in FY totals        | pass     | pass     |
| E13  | Water FY coverage                          | pass     | pass     |

Baseline and improved refer to the existing KuKi pipeline variants, not Harbor
versions. Fresh model calls are stochastic. The historical legacy run achieved
100% for the improved pipeline; this Harbor rerun did **not** reproduce that
case-level improvement. The older results remain historical evidence, not a
claim about the latest run.

## What the partial cases reveal

- **E09:** baseline verified 0/4 citations; improved verified 2/4. The improved
  answer still lacked verified support at Monthly Summary 2026!F16 and fell
  below the required 80% verified-citation threshold.
- **E10:** baseline verified 0/1 citations and omitted the required gaps list.
  Improved verified 1/2 citations and supplied gaps, but 50% verified evidence
  still failed the threshold.
- **E11:** baseline verified 0/1 citations; improved verified 1/2. Both gave the
  expected total and coverage, but citation verification remained insufficient.

The targeted change helped individual citations and uncertainty handling. It
did not improve the overall weighted score in this run. The next application
improvement should target precise, verifiable spreadsheet and policy citations,
then rerun these same cases without weakening the evidence threshold.

## What Harbor adds

- A standard task contract that separates the question, environment and expected
  checks. The agent image excludes case expectations, saved answers and `.env`.
- Per-trial containers, timeouts, task checksums, timestamps and saved answers.
- Concurrent execution and independent results for individual cases.
- A repeatable way to compare pipeline or model changes against the same tasks.

The scoring quality comes from KuKi's cases and verifier, not from adopting the
framework. Harbor executes the checks; it does not establish that the checks
measure everything important.

## Practical limits

- Each task extracts its own documents. This costs more than the legacy runner,
  which shares extracted contexts across cases. E12 alone reprocesses all six.
- The adapter does not report token counts or cost to Harbor. Those fields are
  null, so there is no measured cost comparison.
- Shared verification suits this fixed application adapter. It is not a secure
  grading boundary for an untrusted agent allowed to modify the scorer.
- The current scorer permits overlapping spreadsheet ranges and trusts the
  pipeline's evidence/calculation verification flags. It does not independently
  judge every prose claim or logical inference.
- Harbor's default mean uses all trials for optional check metrics. Report
  calculation as 3/3, not the displayed 3/13; uncertainty is likewise conditional.
- Dependencies inside images are not fully locked, and pipeline selection uses
  the host environment. Task checksums and answer pipeline/model metadata help
  trace runs, but stronger reproducibility needs pinned image dependencies and
  pipeline settings recorded directly in job configuration.
- Thirteen curated cases are useful regression coverage, not proof of general
  correctness. Repeated runs and additional scanned-document, missing-evidence
  and larger-context cases would give a better reliability estimate.
- The dashboard still reads the legacy results. Native Harbor results are
  collected separately and are not automatically reflected there.

## Interview explanation

> I used Harbor to turn the sustainability questions into reproducible tasks.
> Each task runs the real extraction and answering pipeline in a container and
> checks answer correctness, evidence, calculations and uncertainty separately.
> I preserved every answer and score, so I can show failures as well as passes.
> In the latest run all 26 trials executed successfully, but both variants scored
> 88.5%. The remaining weakness is citation verification for spreadsheets and
> policy text. The improved verifier accepted more correct citations, but I
> would not claim an overall score gain until another controlled run shows it.

For a short demo, show E05's checked meter calculation, E09's conflicting workbook
totals and failed citations, then E12's separate-organisation totals. Explain why
a correct number with weak evidence receives partial credit.

## Artifacts and checks

- [Baseline answers and scores](results/baseline.json)
- [Improved answers and scores](results/improved.json)
- Raw Harbor jobs: `apps/ai/jobs/kuki-harbor-{smoke,baseline,improved}/` (local,
  ignored by Git).
- Offline Python suite: 36 passed, including new checks that invalid/missing
  answers earn zero, task packaging excludes secrets and expected answers, and
  rewards preserve existing scoring. Ruff checks passed for the new modules.
- A real Harbor `nop` trial produced no answer. The verifier wrote score 0 and
  recorded the missing `/app/output/answer.json`; Harbor completed without an
  execution exception in 16 seconds. This confirms missing output is a failed
  evaluation rather than an accidental pass. Trial containers were cleaned up.

Setup and collection commands are in [README.md](README.md).
