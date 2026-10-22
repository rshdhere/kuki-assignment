import { AiServiceError, evaluations as loadEvaluations } from "@kuki/ai";
import * as answers from "@kuki/handlers/answers";
import type { RequestHandler, Response } from "express";

/** AI service failures: 503 if worth retrying, 422 if the request can't work. */
function sendAiError(res: Response, err: unknown) {
  if (!(err instanceof AiServiceError)) throw err;
  res.status(err.retryable ? 503 : (err.status ?? 422)).json({
    error: err.retryable ? "ai_unavailable" : "ai_rejected",
    message: err.message,
  });
}

/** POST /answers: answer a question over selected documents, and keep it. */
export const createAnswer: RequestHandler = async (req, res) => {
  const { question, documentIds } = req.body as {
    question: string;
    documentIds: string[];
  };
  try {
    res.status(201).json(await answers.askQuestion(question, documentIds));
  } catch (err) {
    sendAiError(res, err);
  }
};

/** GET /answers: earlier answers, newest first. */
export const listAnswers: RequestHandler = async (req, res) => {
  const { limit } = req.query as unknown as { limit: number };
  res.json({ answers: await answers.listAnswers({ limit }) });
};

/** GET /financial-year: totals and coverage for an Indian financial year. */
export const getFinancialYear: RequestHandler = async (req, res) => {
  const { fy, metric, documentIds } = req.query as unknown as {
    fy: string;
    metric?: string;
    documentIds: string[];
  };
  try {
    res.json(await answers.financialYear(fy, metric ?? null, documentIds));
  } catch (err) {
    sendAiError(res, err);
  }
};

/** GET /evaluations: saved baseline and improved eval runs. */
export const getEvaluations: RequestHandler = async (_req, res) => {
  try {
    res.json(await loadEvaluations());
  } catch (err) {
    sendAiError(res, err);
  }
};
