"""Runs the eval cases end to end (parse, extract, answer, score) for a pipeline.

    uv run kuki-eval run --pipeline baseline
    uv run kuki-eval run --pipeline improved
    uv run kuki-eval compare baseline improved

Extractions are cached per pipeline and file hash in evals/.cache, so a rerun
only re-asks the questions; pass --fresh to extract again.
"""

import argparse
import hashlib
import json
import sys
import time
import traceback
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

import yaml

from kuki_ai.config import APP_DIR, settings
from kuki_ai.evals.scoring import score_case, summarise_scores
from kuki_ai.extraction import extract_document
from kuki_ai.pipeline import PIPELINES
from kuki_ai.qa import answer_question
from kuki_ai.schemas import Answer, DocumentContext, Extraction

EVALS_DIR = APP_DIR / "evals"
RESULTS_DIR = EVALS_DIR / "results"
CACHE_DIR = EVALS_DIR / ".cache"
DEFAULT_DOCS = APP_DIR.parents[1] / "data" / "documents"


def _extract(path: Path, pipeline: str, fresh: bool) -> Extraction:
    data = path.read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    cached = CACHE_DIR / pipeline / f"{sha}.json"
    if cached.exists() and not fresh:
        return Extraction.model_validate_json(cached.read_text())
    print(f"  extracting {path.name}…", file=sys.stderr)
    extraction = extract_document(data, path.name, pipeline=pipeline)
    cached.parent.mkdir(parents=True, exist_ok=True)
    cached.write_text(extraction.model_dump_json(indent=2))
    return extraction


def _context(doc_id: str, filename: str, e: Extraction) -> DocumentContext:
    return DocumentContext(
        id=doc_id,
        filename=filename,
        doc_type=e.doc_type,
        organisation=e.organisation,
        period_start=e.period_start,
        period_end=e.period_end,
        summary=e.summary,
        issues=e.issues,
        facts=e.facts,
        segments=e.segments,
    )


def run(
    pipeline: str,
    docs_dir: Path,
    cases_path: Path,
    only: set[str] | None,
    fresh: bool,
    out: Path | None = None,
) -> Path:
    cases = yaml.safe_load(cases_path.read_text())
    if only:
        cases = [c for c in cases if c["id"] in only]
    needed = sorted({name for c in cases for name in c["documents"]})
    missing = [n for n in needed if not (docs_dir / n).exists()]
    if missing:
        sys.exit(f"Missing documents in {docs_dir}: {', '.join(missing)}")

    print(f"[{pipeline}] extracting {len(needed)} documents", file=sys.stderr)
    contexts: dict[str, DocumentContext] = {}
    extraction_summary = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        extractions = dict(
            zip(
                needed,
                pool.map(lambda n: _extract(docs_dir / n, pipeline, fresh), needed),
                strict=True,
            )
        )
    for i, name in enumerate(needed, start=1):
        e = extractions[name]
        contexts[name] = _context(f"doc{i}", name, e)
        reported = [f for f in e.facts if f.origin == "reported"]
        extraction_summary.append(
            {
                "filename": name,
                "doc_type": e.doc_type,
                "organisation": e.organisation,
                "period": [e.period_start, e.period_end],
                "facts": len(e.facts),
                "reported_verified": sum(f.verified for f in reported),
                "reported": len(reported),
                "issues": e.issues,
            }
        )
    filename_by_id = {c.id: c.filename for c in contexts.values()}

    def run_case(case: dict) -> dict:
        started = time.monotonic()
        try:
            answer = answer_question(
                case["question"], [contexts[n] for n in case["documents"]], pipeline
            )
            score = score_case(case, answer, filename_by_id)
            result_answer = answer.model_dump()
        except Exception as err:  # keep going; an error is a failed case
            traceback.print_exc()
            score = {"mark": "error", "checks": {}, "notes": [f"{type(err).__name__}: {err}"]}
            result_answer = None
        print(f"  {case['id']} {score['mark']:<7} {'; '.join(score['notes'])}", file=sys.stderr)
        return {
            "id": case["id"],
            "title": case["title"],
            "question": case["question"],
            "documents": case["documents"],
            "source": case.get("source"),
            "expect": case.get("expect", {}),
            "answer": result_answer,
            "score": score,
            "seconds": round(time.monotonic() - started, 1),
        }

    print(f"[{pipeline}] answering {len(cases)} cases", file=sys.stderr)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(run_case, cases))

    output = {
        "pipeline": pipeline,
        "model": settings.openai_model,
        "ran_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "summary": summarise_scores(results),
        "extractions": extraction_summary,
        "cases": results,
    }
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = out or RESULTS_DIR / f"{pipeline}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False))
    s = output["summary"]
    print(
        f"[{pipeline}] {s['pass']} pass, {s['partial']} partial, {s['fail']} fail, "
        f"{s['error']} error · score {s['score']:.0%} → {out_path}",
        file=sys.stderr,
    )
    return out_path


def rescore(path: Path, cases_path: Path) -> None:
    """Re-scores a saved run from its stored answers, with the current scorer and cases."""
    run_data = json.loads(path.read_text())
    cases = {c["id"]: c for c in yaml.safe_load(cases_path.read_text())}
    ids_by_name = {}
    for c in run_data["cases"]:
        if c["answer"]:
            for e in c["answer"]["evidence"]:
                ids_by_name[e["document_id"]] = e["filename"]
    for c in run_data["cases"]:
        case = cases[c["id"]]
        c["expect"], c["source"] = case.get("expect", {}), case.get("source")
        if c["answer"]:
            c["score"] = score_case(case, Answer.model_validate(c["answer"]), ids_by_name)
    run_data["summary"] = summarise_scores(run_data["cases"])
    run_data["rescored_at"] = datetime.now(UTC).isoformat(timespec="seconds")
    path.write_text(json.dumps(run_data, indent=2, ensure_ascii=False))
    s = run_data["summary"]
    print(
        f"{path.name}: {s['pass']} pass, {s['partial']} partial, {s['fail']} fail · {s['score']:.0%}"
    )


def compare(before: str, after: str) -> Path:
    a = json.loads((RESULTS_DIR / f"{before}.json").read_text())
    b = json.loads((RESULTS_DIR / f"{after}.json").read_text())
    rank = {"error": 0, "fail": 0, "partial": 1, "pass": 2}
    b_cases = {c["id"]: c for c in b["cases"]}
    rows = []
    for ca in a["cases"]:
        cb = b_cases.get(ca["id"])
        if not cb:
            continue
        ma, mb = ca["score"]["mark"], cb["score"]["mark"]
        change = "fixed" if rank[mb] > rank[ma] else "regressed" if rank[mb] < rank[ma] else None
        rows.append(
            {
                "id": ca["id"],
                "title": ca["title"],
                before: ma,
                after: mb,
                "change": change,
                f"{before}_notes": ca["score"]["notes"],
                f"{after}_notes": cb["score"]["notes"],
            }
        )
    comparison = {
        "before": before,
        "after": after,
        "summary": {before: a["summary"], after: b["summary"]},
        "cases": rows,
    }
    out = RESULTS_DIR / "comparison.json"
    out.write_text(json.dumps(comparison, indent=2, ensure_ascii=False))

    lines = [
        f"# Eval comparison: {before} → {after}",
        "",
        f"| | {before} | {after} |",
        "|---|---|---|",
        f"| Score (pass = 1, partial = ½) | {a['summary']['score']:.0%} | {b['summary']['score']:.0%} |",
        f"| Pass / partial / fail | {a['summary']['pass']} / {a['summary']['partial']} / {a['summary']['fail'] + a['summary']['error']} "
        f"| {b['summary']['pass']} / {b['summary']['partial']} / {b['summary']['fail'] + b['summary']['error']} |",
    ]
    for check in a["summary"]["checks"]:
        ra = a["summary"]["checks"][check]
        rb = b["summary"]["checks"].get(check, {"passed": 0, "applicable": 0})
        lines.append(
            f"| {check} | {ra['passed']}/{ra['applicable']} | {rb['passed']}/{rb['applicable']} |"
        )
    lines += [
        "",
        f"| Case | {before} | {after} | Change | Notes ({after}) |",
        "|---|---|---|---|---|",
    ]
    for r in rows:
        notes = "; ".join(r[f"{after}_notes"]) or "–"
        lines.append(
            f"| {r['id']} {r['title']} | {r[before]} | {r[after]} | {r['change'] or ''} | {notes} |"
        )
    (RESULTS_DIR / "comparison.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))
    return out


def main() -> None:
    parser = argparse.ArgumentParser(prog="kuki-eval")
    sub = parser.add_subparsers(dest="command", required=True)
    r = sub.add_parser("run", help="run the cases for one pipeline")
    r.add_argument("--pipeline", default="baseline", choices=sorted(PIPELINES))
    r.add_argument("--docs", type=Path, default=DEFAULT_DOCS)
    r.add_argument("--cases", type=Path, default=EVALS_DIR / "cases.yaml")
    r.add_argument("--only", help="comma-separated case ids")
    r.add_argument("--fresh", action="store_true", help="ignore cached extractions")
    r.add_argument("--out", type=Path, help="write results here instead of results/<pipeline>.json")
    rs = sub.add_parser("rescore", help="re-score saved runs from their stored answers")
    rs.add_argument("paths", type=Path, nargs="+")
    rs.add_argument("--cases", type=Path, default=EVALS_DIR / "cases.yaml")
    c = sub.add_parser("compare", help="compare two saved runs")
    c.add_argument("before")
    c.add_argument("after")
    args = parser.parse_args()
    if args.command == "run":
        run(
            args.pipeline,
            args.docs,
            args.cases,
            set(args.only.split(",")) if args.only else None,
            args.fresh,
            args.out,
        )
    elif args.command == "rescore":
        for path in args.paths:
            rescore(path, args.cases)
    else:
        compare(args.before, args.after)


if __name__ == "__main__":
    main()
