import { z } from "zod";

export const askSchema = z.object({
  question: z.string().trim().min(3).max(2000),
  /** Documents to answer from; all processed documents when omitted or empty. */
  documentIds: z.array(z.uuid()).max(100).default([]),
});

export const listAnswersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const metrics = [
  "electricity",
  "water",
  "waste",
  "fuel",
  "emissions",
  "cost",
] as const;

export const financialYearQuerySchema = z.object({
  /** e.g. "2024-25", "FY 2024-25" or "FY25". */
  fy: z.string().trim().min(2).max(20),
  metric: z.enum(metrics).optional(),
  /** Comma-separated document ids; all processed documents when omitted. */
  documentIds: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : []))
    .pipe(z.array(z.uuid())),
});
