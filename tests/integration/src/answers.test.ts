import { AiServiceError } from "@kuki/ai";
import { db } from "@kuki/drizzle";
import { documents } from "@kuki/drizzle/schema";
import { processExtractionJob } from "@kuki/handlers/extraction";
import type { Answer } from "@kuki/types";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "server/app";
import { extraction, sha } from "@/helpers";

const { ask, extract, financialYear } = vi.hoisted(() => ({
  ask: vi.fn(),
  extract: vi.fn(),
  financialYear: vi.fn(),
}));
vi.mock("@kuki/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@kuki/ai")>()),
  ask,
  extract,
  financialYear,
}));

const answer: Answer = {
  question: "What did the Adani bill report?",
  status: "answered",
  answer: "47407 kWh in April 2024 [E1].",
  key_values: [],
  calculations: [],
  evidence: [],
  gaps: [],
  financial_year: null,
  model: "test-model",
  pipeline: "baseline",
};

/** A processed document, run through the real extraction handler. */
async function processed(filename: string, status = "queued" as const) {
  const id = crypto.randomUUID();
  await db.insert(documents).values({
    id,
    filename,
    contentType: "application/pdf",
    size: 1,
    sha256: sha(id.slice(0, 1)) + id,
    bucket: "kuki-test-bucket",
    s3Key: `uploads/${id}`,
    status,
  });
  await processExtractionJob(
    {
      type: "document.uploaded",
      uploadId: id,
      bucket: "kuki-test-bucket",
      key: `uploads/${id}`,
      filename,
      contentType: "application/pdf",
      size: 1,
      sha256: "x",
      uploadedAt: new Date().toISOString(),
    },
    1,
  );
  return id;
}

beforeEach(() => {
  extract.mockResolvedValue(extraction());
  ask.mockResolvedValue(answer);
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  ask.mockReset();
  financialYear.mockReset();
});

describe("POST /answers", () => {
  it("answers over the selected documents and keeps the answer", async () => {
    const adani = await processed("adani.pdf");
    await processed("other.pdf");

    const res = await request(app)
      .post("/answers")
      .send({ question: answer.question, documentIds: [adani] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      question: answer.question,
      documentIds: [adani],
      status: "answered",
      answer: { answer: answer.answer },
    });
    const [question, contexts] = ask.mock.calls[0]!;
    expect(question).toBe(answer.question);
    expect(contexts).toHaveLength(1);
    expect(contexts[0]).toMatchObject({
      id: adani,
      filename: "adani.pdf",
      organisation: "J Kumar MEPL JV",
      facts: [{ key: "units_consumed", value_number: 47407 }, {}],
      segments: [{ locator: { page: 1 }, text: "Units Consumed 47407" }],
    });

    const list = await request(app).get("/answers");
    expect(list.body.answers).toHaveLength(1);
    expect(list.body.answers[0].id).toBe(res.body.id);
  });

  it("uses every processed document when none are selected", async () => {
    await processed("a.pdf");
    await processed("b.pdf");

    await request(app).post("/answers").send({ question: "Anything?" });

    expect(ask.mock.calls[0]![1]).toHaveLength(2);
  });

  it("responds 503 when the AI service is unavailable", async () => {
    ask.mockRejectedValue(new AiServiceError("rate limited", true, 503));

    const res = await request(app).post("/answers").send({ question: "Hi?" });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe("ai_unavailable");
  });

  it("rejects an empty question", async () => {
    const res = await request(app).post("/answers").send({ question: " " });
    expect(res.status).toBe(400);
  });
});

describe("GET /financial-year", () => {
  it("passes the year, metric and documents to the AI service", async () => {
    const id = await processed("adani.pdf");
    financialYear.mockResolvedValue({ fy: "FY 2024-25", groups: [] });

    const res = await request(app).get(
      `/financial-year?fy=2024-25&metric=electricity&documentIds=${id}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.fy).toBe("FY 2024-25");
    const [fy, metric, contexts] = financialYear.mock.calls[0]!;
    expect([fy, metric, contexts.length]).toEqual([
      "2024-25",
      "electricity",
      1,
    ]);
  });

  it("rejects an unknown metric", async () => {
    const res = await request(app).get(
      "/financial-year?fy=2024-25&metric=gold",
    );
    expect(res.status).toBe(400);
  });
});
