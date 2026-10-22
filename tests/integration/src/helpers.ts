import { db } from "@kuki/drizzle";
import { documentEvents, documents } from "@kuki/drizzle/schema";
import type { AiExtraction } from "@kuki/types";
import { eq } from "drizzle-orm";

export const sha = (c: string) => c.repeat(64);

export const pdf = (overrides: Record<string, unknown> = {}) => ({
  filename: "Adani commercial electricity bill.pdf",
  contentType: "application/pdf",
  size: 1234,
  sha256: sha("a"),
  ...overrides,
});

export const getDoc = (id: string) =>
  db.query.documents.findFirst({ where: eq(documents.id, id) });

export const eventTypes = async (id: string) =>
  (
    await db
      .select({ type: documentEvents.type })
      .from(documentEvents)
      .where(eq(documentEvents.documentId, id))
      .orderBy(documentEvents.id)
  ).map((e) => e.type);

/** A small /extract response from the AI service. */
export const extraction = (
  overrides: Partial<AiExtraction> = {},
): AiExtraction => ({
  doc_type: "electricity_bill",
  title: "Adani commercial electricity bill",
  organisation: "J Kumar MEPL JV",
  issuer: "Adani Electricity",
  period_start: "2024-04-01",
  period_end: "2024-04-30",
  summary: "April 2024 commercial electricity bill.",
  page_count: 2,
  facts: [
    {
      key: "units_consumed",
      label: "Units Consumed",
      category: "consumption",
      metric: "electricity",
      series: null,
      value_text: "47407",
      value_number: 47407,
      unit: "kWh",
      period_start: "2024-04-01",
      period_end: "2024-04-30",
      note: "unit not printed; assumed",
      origin: "reported",
      locator: { page: 1 },
      quote: "Units Consumed 47407",
      verified: true,
      verification: "Quote found on p.1",
      derivation: null,
    },
    {
      key: "units_consumed_per_day",
      label: "Units Consumed per day",
      category: "consumption",
      metric: "electricity",
      series: null,
      value_text: "1,580.23 kWh",
      value_number: 1580.2333,
      unit: "kWh/day",
      period_start: "2024-04-01",
      period_end: "2024-04-30",
      note: null,
      origin: "calculated",
      locator: { page: 1 },
      quote: null,
      verified: true,
      verification: "Derived from a reported value",
      derivation: "47407 ÷ 30 days",
    },
  ],
  issues: ["Unit not printed next to Units Consumed"],
  segments: [
    {
      ordinal: 0,
      locator: { page: 1 },
      text: "Units Consumed 47407",
      cells: null,
      scanned: false,
    },
  ],
  model: "test-model",
  pipeline: "baseline",
  ...overrides,
});
