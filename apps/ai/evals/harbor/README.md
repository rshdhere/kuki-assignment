# Harbor evaluations

See [the live assessment](assessment.md) for actual baseline/improved results,
framework tradeoffs and interview talking points.

The 13 cases in `../cases.yaml` are the source of truth. The exporter produces
one native Harbor task per case with `instruction.md`, `task.toml`, a Docker
environment and `tests/test.sh`. Expected answers and source references are
provided only to the verifier, after the agent runs.

From `apps/ai`, with the six supplied files in `../../data/documents/`:

```sh
uv run python -m kuki_ai.evals.harbor export
```

Install Harbor into a separate virtual environment and install KuKi into it:

```sh
uv venv .harbor-venv
uv pip install --python .harbor-venv/bin/python harbor==0.24.0 .
```

Export `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in your shell. These are
passed only to the pipeline process inside the sandbox. Never put credentials
in generated tasks. Run from `apps/ai` with Docker available:

```sh
KUKI_PIPELINE=baseline .harbor-venv/bin/harbor run \
  -p evals/harbor/tasks -a kuki_ai.evals.harbor_agent:KukiAgent \
  --job-name kuki-harbor-baseline --artifact /app/output/answer.json
KUKI_PIPELINE=improved .harbor-venv/bin/harbor run \
  -p evals/harbor/tasks -a kuki_ai.evals.harbor_agent:KukiAgent \
  --job-name kuki-harbor-improved --artifact /app/output/answer.json
```

Each task runs the actual parser, model extraction, question answering and
existing deterministic scorer. The pipeline adapter uses task-local request
data rather than interpreting the instruction as a new coding task. Each trial
starts with its own extraction cache; these runs make paid model calls.

The verifier writes `reward.json` with `score` (pass 1, partial 0.5, fail/error 0)
and applicable `answer`, `evidence`, `calculation`, `uncertainty` metrics.
Non-applicable checks are omitted from each task's rewards. Harbor 0.24.0's
default aggregate divides by all trials, so its displayed calculation and
uncertainty means are **not applicable-case pass rates**. Use the collected
summary's `checks` denominators to report those rates accurately.
`score.json` contains the detailed mark and failure notes. Use Harbor's job
results to compare the same cases across pipelines; compare the `score` metric,
not an average of heterogeneous check metrics.

The existing `../results/baseline.json`, `improved.json` and comparison files
are historical KuKi runs, not Harbor trials. They remain usable by the dashboard
and legacy `kuki-eval` commands. New Harbor jobs do not overwrite them or invent
Harbor execution metadata for historical answers.

Shared verification is explicit because the scorer reads the answer produced
inside the task container. This adapter evaluates the fixed KuKi application,
not an untrusted coding agent. Existing scorer limitations (including broad
spreadsheet ranges and reliance on pipeline verification flags) still apply.

Generated tasks contain local copies of the assignment documents and runtime
source. They are ignored by Git. Re-export to a new `--out` directory after
changing the cases or application; existing task directories are never overwritten.

Collect completed runs into shareable files containing individual answers,
expected outcomes, source references, scores, trial checksums and timestamps:

```sh
uv run python -m kuki_ai.evals.harbor collect jobs/kuki-harbor-baseline \
  --out evals/harbor/results/baseline.json
uv run python -m kuki_ai.evals.harbor collect jobs/kuki-harbor-improved \
  --out evals/harbor/results/improved.json
```

For machines whose default Docker context points at an unavailable Desktop
socket, set `DOCKER_HOST=unix:///var/run/docker.sock` when running Harbor.
`--env-file .env` can load host model settings without shell exports.

References: [task format](https://docs.harborframework.com/tasks/configuration),
[custom agents](https://docs.harborframework.com/agents/custom-agents),
[verifiers](https://docs.harborframework.com/tasks/verifier).
