import {
  createAnswer,
  getEvaluations,
  getFinancialYear,
  listAnswers,
} from "@kuki/controllers/answers";
import { validate } from "@kuki/validators";
import {
  askSchema,
  financialYearQuerySchema,
  listAnswersQuerySchema,
} from "@kuki/validators/answers";
import { Router } from "express";

export const answersRouter = Router();

answersRouter.post("/", validate({ body: askSchema }), createAnswer);
answersRouter.get(
  "/",
  validate({ query: listAnswersQuerySchema }),
  listAnswers,
);

export const financialYearRouter = Router();

financialYearRouter.get(
  "/",
  validate({ query: financialYearQuerySchema }),
  getFinancialYear,
);

export const evaluationsRouter = Router();

evaluationsRouter.get("/", getEvaluations);
