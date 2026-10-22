"""Export the KuKi cases as Harbor tasks and execute their agent/verifier steps."""

import argparse
import json
import shutil
from pathlib import Path

import yaml

from kuki_ai.config import APP_DIR
from kuki_ai.evals.scoring import score_case, summarise_scores
from kuki_ai.pipeline import PIPELINES
from kuki_ai.schemas import Answer

DEFAULT_OUTPUT = APP_DIR / "evals" / "harbor" / "tasks"


def export_tasks(output: Path, docs: Path) -> None:
    cases = yaml.safe_load((APP_DIR / "evals/cases.yaml").read_text())
    needed = {name for case in cases for name in case["documents"]}
    missing = sorted(name for name in needed if not (docs / name).is_file())
    if missing:
        raise ValueError(f"Missing assignment documents: {', '.join(missing)}")
    if output.exists():
        raise ValueError(f"Output already exists: {output}; choose a new --out directory")
    for case in cases:
        task = output / case["id"].lower()
        environment = task / "environment"
        tests = task / "tests"
        tests.mkdir(parents=True)
        (environment / "documents").mkdir(parents=True)
        # Copy only runtime source and package metadata, never .env, saved answers,
        # cached extractions or the expected case definitions into the agent image.
        shutil.copytree(
            APP_DIR / "src", environment / "src", ignore=shutil.ignore_patterns("__pycache__")
        )
        shutil.copy2(APP_DIR / "pyproject.toml", environment / "pyproject.toml")
        for name in case["documents"]:
            shutil.copy2(docs / name, environment / "documents" / name)
        request = {key: case[key] for key in ("id", "question", "documents")}
        (environment / "request.json").write_text(json.dumps(request, indent=2))
        (task / "instruction.md").write_text(
            case["question"] + "\n\nUse only the supplied documents in /app/documents. "
            "Write the structured KuKi answer to /app/output/answer.json, retaining "
            "evidence locations, calculations, reported/calculated distinctions and gaps.\n"
        )
        (task / "task.toml").write_text(
            'schema_version = "1.3"\n\n'
            '[metadata]\ncategory = "sustainability"\n'
            f'case_id = "{case["id"]}"\n\n'
            "[agent]\ntimeout_sec = 1800\n\n"
            '[verifier]\ntimeout_sec = 120\nenvironment_mode = "shared"\n\n'
            "[environment]\ncpus = 1\nmemory_mb = 2048\n"
        )
        (environment / "Dockerfile").write_text(
            "FROM python:3.12-slim\nWORKDIR /app\n"
            "COPY pyproject.toml /app/pyproject.toml\nCOPY src /app/src\n"
            "RUN pip install --no-cache-dir .\n"
            "COPY documents /app/documents\nCOPY request.json /app/request.json\n"
            "RUN mkdir -p /app/output\n"
        )
        (tests / "case.json").write_text(json.dumps(case, indent=2))
        (tests / "test.sh").write_text(
            "#!/bin/sh\nset -eu\n"
            "python -m kuki_ai.evals.harbor verify --case /tests/case.json "
            "--answer /app/output/answer.json --out /logs/verifier\n"
        )
        (tests / "test.sh").chmod(0o755)
    print(f"Exported {len(cases)} Harbor tasks to {output}")


def answer(request_path: Path, pipeline: str, output: Path) -> None:
    from kuki_ai.evals.run import _context, _extract
    from kuki_ai.qa import answer_question

    request = json.loads(request_path.read_text())
    contexts = [
        _context(f"doc{i}", name, _extract(Path("/app/documents") / name, pipeline, False))
        for i, name in enumerate(request["documents"], 1)
    ]
    result = answer_question(request["question"], contexts, pipeline)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(result.model_dump_json(indent=2))


def verify(case_path: Path, answer_path: Path, output: Path) -> None:
    case = json.loads(case_path.read_text())
    try:
        result = Answer.model_validate_json(answer_path.read_text())
        filenames = {f"doc{i}": name for i, name in enumerate(case["documents"], 1)}
        score = score_case(case, result, filenames)
    except (OSError, ValueError) as exc:
        score = {"mark": "error", "checks": {}, "notes": [str(exc)]}
    rewards = {"score": {"pass": 1.0, "partial": 0.5}.get(score["mark"], 0.0)}
    rewards.update(
        {name: float(value) for name, value in score["checks"].items() if value is not None}
    )
    output.mkdir(parents=True, exist_ok=True)
    (output / "reward.json").write_text(json.dumps(rewards, indent=2))
    (output / "score.json").write_text(json.dumps(score, indent=2))


def collect(job: Path, output: Path) -> None:
    """Keep shareable answers and scores without copying job config or credentials."""
    job_result = json.loads((job / "result.json").read_text())
    if not job_result.get("finished_at"):
        raise ValueError("Harbor job has not finished")
    cases = {
        case["id"].lower(): case
        for case in yaml.safe_load((APP_DIR / "evals/cases.yaml").read_text())
    }
    results = []
    for trial_path in sorted(job.glob("*/result.json")):
        trial = json.loads(trial_path.read_text())
        case = cases[trial["task_name"]]
        directory = trial_path.parent
        score_path = directory / "verifier/score.json"
        answer_path = directory / "artifacts/app/output/answer.json"
        score = (
            json.loads(score_path.read_text())
            if score_path.exists()
            else {"mark": "error", "checks": {}, "notes": ["No verifier score artifact"]}
        )
        results.append(
            {
                **case,
                "answer": json.loads(answer_path.read_text()) if answer_path.exists() else None,
                "score": score,
                "harbor": {
                    key: trial.get(key)
                    for key in (
                        "trial_name",
                        "task_checksum",
                        "started_at",
                        "finished_at",
                        "exception_info",
                        "verifier_result",
                        "agent_execution",
                    )
                },
            }
        )
    if len(results) != job_result["n_total_trials"]:
        raise ValueError("Missing Harbor trial results")
    pipelines = {case["answer"]["pipeline"] for case in results if case["answer"]}
    if len(pipelines) > 1:
        raise ValueError(f"Expected one pipeline, got {pipelines}")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(
            {
                "framework": "harbor",
                "validated_framework_version": "0.24.0",
                "job_name": job.name,
                "pipeline": next(iter(pipelines), None),
                "started_at": job_result["started_at"],
                "finished_at": job_result["finished_at"],
                "summary": summarise_scores(results),
                "cases": results,
            },
            indent=2,
            ensure_ascii=False,
        )
    )
    print(f"Collected {len(results)} trials into {output}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    export = sub.add_parser("export")
    export.add_argument("--docs", type=Path, default=APP_DIR.parents[1] / "data/documents")
    export.add_argument("--out", type=Path, default=DEFAULT_OUTPUT)
    run = sub.add_parser("answer")
    run.add_argument("--request", type=Path, default=Path("/app/request.json"))
    run.add_argument("--pipeline", choices=sorted(PIPELINES), default="improved")
    run.add_argument("--out", type=Path, default=Path("/app/output/answer.json"))
    check = sub.add_parser("verify")
    check.add_argument("--case", type=Path, required=True)
    check.add_argument("--answer", type=Path, required=True)
    check.add_argument("--out", type=Path, required=True)
    gather = sub.add_parser("collect")
    gather.add_argument("job", type=Path)
    gather.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "export":
        export_tasks(args.out, args.docs)
    elif args.command == "answer":
        answer(args.request, args.pipeline, args.out)
    elif args.command == "verify":
        verify(args.case, args.answer, args.out)
    else:
        collect(args.job, args.out)


if __name__ == "__main__":
    main()
