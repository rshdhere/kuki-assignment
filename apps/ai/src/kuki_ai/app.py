"""HTTP API used by the TypeScript worker and server.

Errors carry a `retryable` flag: the worker retries 503s through SQS backoff
and fails the document straight away on 422s.
"""

import json
from functools import cache
from pathlib import Path

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from kuki_ai import fy as fy_mod
from kuki_ai import llm
from kuki_ai.config import APP_DIR, settings
from kuki_ai.extraction import extract_document
from kuki_ai.parsing import UnsupportedDocumentError
from kuki_ai.qa import answer_question
from kuki_ai.schemas import Answer, DocumentContext, Extraction, FinancialYearSummary

RESULTS_DIR = APP_DIR / "evals" / "results"

app = FastAPI(title="KuKi AI", version="0.1.0")


@app.exception_handler(llm.TransientError)
async def transient(_req: Request, err: llm.TransientError):
    return JSONResponse({"error": "transient", "retryable": True, "message": str(err)}, 503)


@app.exception_handler(llm.PermanentError)
async def permanent(_req: Request, err: llm.PermanentError):
    return JSONResponse({"error": "permanent", "retryable": False, "message": str(err)}, 422)


@app.exception_handler(UnsupportedDocumentError)
async def unsupported(_req: Request, err: UnsupportedDocumentError):
    return JSONResponse({"error": "unsupported", "retryable": False, "message": str(err)}, 422)


@cache
def s3():
    return boto3.client("s3", region_name=settings.aws_region)


class ExtractRequest(BaseModel):
    document_id: str
    bucket: str
    key: str
    filename: str
    content_type: str | None = None
    pipeline: str | None = None


class AskRequest(BaseModel):
    question: str
    documents: list[DocumentContext]
    pipeline: str | None = None


class FinancialYearRequest(BaseModel):
    fy: str
    metric: str | None = None
    documents: list[DocumentContext]


@app.get("/health")
def health():
    return {"status": "ok", "model": settings.openai_model}


@app.post("/extract", response_model=Extraction)
def extract(req: ExtractRequest) -> Extraction:
    try:
        obj = s3().get_object(Bucket=req.bucket, Key=req.key)
        data = obj["Body"].read()
    except ClientError as err:
        code = err.response.get("Error", {}).get("Code", "")
        if code in ("NoSuchKey", "404", "AccessDenied", "403"):
            raise llm.PermanentError(f"Cannot read s3://{req.bucket}/{req.key}: {code}") from err
        raise llm.TransientError(f"S3: {err}") from err
    except BotoCoreError as err:
        raise llm.TransientError(f"S3: {err}") from err
    return extract_document(data, req.filename, req.content_type, req.pipeline)


@app.post("/ask", response_model=Answer)
def ask(req: AskRequest) -> Answer:
    if not req.question.strip():
        raise HTTPException(400, "question is empty")
    return answer_question(req.question, req.documents, req.pipeline)


@app.post("/financial-year", response_model=FinancialYearSummary)
def financial_year(req: FinancialYearRequest) -> FinancialYearSummary:
    year = fy_mod.parse_fy(req.fy)
    if not year:
        raise HTTPException(400, f"Not an Indian financial year: {req.fy!r}")
    return fy_mod.summarise(req.documents, year, req.metric)


def _load(path: Path):
    return json.loads(path.read_text()) if path.exists() else None


@app.get("/evaluations")
def evaluations():
    """Saved eval runs: baseline, improved and their comparison."""
    return {
        "runs": {
            p.stem: _load(p) for p in sorted(RESULTS_DIR.glob("*.json")) if p.stem != "comparison"
        },
        "comparison": _load(RESULTS_DIR / "comparison.json"),
    }
