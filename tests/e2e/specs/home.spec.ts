import { expect, test } from "@playwright/test";

test("the website opens on the financial year", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/financial-year$/);
});

test("documents page renders", async ({ page }) => {
  await page.goto("/documents");

  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Documents" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Upload files" }),
  ).toBeVisible();
});

const pdf = (name: string) => ({
  name,
  mimeType: "application/pdf",
  buffer: Buffer.from(`%PDF-1.4 ${name}`),
});

test("upload presigns, puts to S3 and queues every file", async ({ page }) => {
  const puts: string[] = [];
  const completed: string[] = [];

  await page.route("http://localhost:4000/uploads", async (route) => {
    const { files } = route.request().postDataJSON() as {
      files: { filename: string; sha256: string }[];
    };
    for (const f of files) expect(f.sha256).toMatch(/^[a-f0-9]{64}$/);
    await route.fulfill({
      status: 201,
      json: {
        uploads: files.map((_, i) => ({
          uploadId: `00000000-0000-4000-8000-00000000000${i}`,
          url: `https://s3.test/uploads/${i}`,
          method: "PUT",
          headers: { "Content-Type": "application/pdf" },
        })),
      },
    });
  });
  await page.route("https://s3.test/**", async (route) => {
    puts.push(route.request().url());
    await route.fulfill({ status: 200 });
  });
  await page.route(
    "http://localhost:4000/uploads/*/complete",
    async (route) => {
      completed.push(route.request().url());
      await route.fulfill({ status: 202, json: { status: "queued" } });
    },
  );

  await page.goto("/documents");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload files" }).click();
  await (await chooser).setFiles([pdf("a.pdf"), pdf("b.pdf"), pdf("c.pdf")]);

  await expect(page.getByRole("status")).toContainText("3 files queued");
  expect(puts).toHaveLength(3);
  expect(completed).toHaveLength(3);
});

test("upload rejects unsupported files without calling the server", async ({
  page,
}) => {
  let called = false;
  await page.route("http://localhost:4000/uploads**", (route) => {
    called = true;
    return route.abort();
  });

  await page.goto("/documents");
  await page.locator("#upload").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  });

  const toast = page
    .getByRole("region", { name: "Notifications" })
    .getByRole("alert");
  await expect(toast).toContainText("1 file not uploaded");
  await expect(toast).toContainText("Not a PDF, XLSX or CSV");
  expect(called).toBe(false);
});

// Stubs the read endpoints with one processed bill, so pages render real data shapes.
const docId = "11111111-1111-4111-8111-111111111111";
const doc = {
  id: docId,
  filename: "Adani commercial electricity bill.pdf",
  contentType: "application/pdf",
  size: 120000,
  sha256: "a".repeat(64),
  status: "succeeded",
  duplicateOf: null,
  attempts: 1,
  lastError: null,
  docType: "electricity_bill",
  title: "Adani commercial electricity bill",
  organisation: "J Kumar MEPL JV",
  issuer: "Adani Electricity",
  summary: "April 2024 bill.",
  issues: [],
  factCount: 2,
  periodStart: "2024-04-01",
  periodEnd: "2024-04-30",
  pageCount: 2,
  createdAt: "2026-10-22T00:00:00.000Z",
  uploadedAt: "2026-10-22T00:00:01.000Z",
  completedAt: "2026-10-22T00:01:00.000Z",
};
const fact = (over: Record<string, unknown>) => ({
  id: 1,
  documentId: docId,
  key: "units_consumed",
  label: "Units Consumed",
  category: "consumption",
  metric: "electricity",
  series: null,
  valueText: "47407",
  valueNumber: 47407,
  unit: "kWh",
  periodStart: "2024-04-01",
  periodEnd: "2024-04-30",
  note: null,
  origin: "reported",
  locator: { page: 1 },
  locatorLabel: "p.1",
  quote: "Units Consumed 47407",
  verified: true,
  verification: "Quote found on p.1",
  derivation: null,
  ...over,
});

async function stubApi(page: import("@playwright/test").Page) {
  await page.route("http://localhost:4000/documents?*", (route) =>
    route.fulfill({ json: { documents: [doc], nextBefore: null } }),
  );
  await page.route(`http://localhost:4000/documents/${docId}`, (route) =>
    route.fulfill({
      json: {
        document: doc,
        events: [],
        facts: [
          fact({}),
          fact({
            id: 2,
            key: "units_consumed_per_day",
            label: "Units Consumed per day",
            valueText: "1,580.23 kWh",
            origin: "calculated",
            quote: null,
            derivation: "47407 ÷ 30 days",
          }),
        ],
        segments: [
          {
            ordinal: 0,
            locator: { page: 1 },
            locatorLabel: "p.1",
            text: "Bill Period 01-04-2024\nUnits Consumed 47407",
            scanned: false,
          },
        ],
      },
    }),
  );
  await page.route("http://localhost:4000/events?*", (route) =>
    route.fulfill({ json: { events: [] } }),
  );
  await page.route("http://localhost:4000/answers?*", (route) =>
    route.fulfill({ json: { answers: [] } }),
  );
  await page.route("http://localhost:4000/financial-year?*", (route) =>
    route.fulfill({
      json: {
        fy: "FY 2024-25",
        start: "2024-04-01",
        end: "2025-03-31",
        metric: null,
        groups: [],
        combined: null,
        notes: [],
        documents_without_overlap: [],
      },
    }),
  );
  await page.route("http://localhost:4000/evaluations", (route) =>
    route.fulfill({ json: { runs: {}, comparison: null } }),
  );
}

test("sidebar reaches every screen", async ({ page }) => {
  await stubApi(page);
  await page.goto("/documents");
  const nav = page.getByRole("navigation", { name: "Workspace" });

  for (const [label, heading] of [
    ["Extracted facts", "Adani commercial electricity bill"],
    ["Ask", "Ask"],
    ["Financial year", "FY 2024-25"],
    ["Evaluation", "Evaluation"],
  ] as const) {
    await nav.getByRole("link", { name: label }).click();
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute(
      "aria-current",
      "page",
    );
    if (heading) {
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
    }
  }
});

test("documents table shows processed documents from the server", async ({
  page,
}) => {
  await stubApi(page);
  await page.goto("/documents");
  const table = page.getByRole("region", { name: "Your documents" });

  await expect(
    table.getByRole("link", {
      name: "Adani commercial electricity bill",
      exact: true,
    }),
  ).toBeVisible();
  await expect(table.getByText("J Kumar MEPL JV")).toBeVisible();
  await expect(table.getByText("Apr 2024")).toBeVisible();
  await expect(table.getByText("Ready", { exact: true })).toBeVisible();
  // No system details for people reading the page.
  await expect(table.getByText("1/10")).toHaveCount(0);
});

test("picking a fact shows its source; a calculated fact shows its derivation", async ({
  page,
}) => {
  await stubApi(page);
  await page.goto(`/facts?id=${docId}`);
  const source = page.getByRole("region", { name: "Source" });

  await expect(source.locator("mark")).toHaveText("Units Consumed 47407");

  await page.getByRole("button", { name: "Calculated", exact: true }).click();
  await page.getByRole("button", { name: "Units Consumed per day" }).click();
  await expect(source).toContainText("KuKi worked it out: 47407 ÷ 30 days");
});

test("asking a question shows the answer with checked evidence", async ({
  page,
}) => {
  await stubApi(page);
  await page.route("http://localhost:4000/answers", (route) =>
    route.fulfill({
      status: 201,
      json: {
        id: "22222222-2222-4222-8222-222222222222",
        question: "How much electricity?",
        documentIds: [docId],
        status: "answered",
        createdAt: "2026-10-22T00:02:00.000Z",
        answer: {
          question: "How much electricity?",
          status: "answered",
          answer: "47,407 kWh in April 2024 [E1].",
          key_values: [],
          calculations: [],
          evidence: [
            {
              id: "E1",
              document_id: docId,
              filename: doc.filename,
              page: 1,
              sheet: null,
              cell_range: null,
              locator_label: "p.1",
              quote: "Units Consumed 47407",
              verified: true,
              verification: "Quote found on p.1",
            },
          ],
          gaps: [],
          financial_year: null,
          model: "test",
          pipeline: "baseline",
        },
      },
    }),
  );
  await page.goto("/ask");

  await page.getByLabel("Your question").fill("How much electricity?");
  await page.getByRole("button", { name: "Get answer" }).click();

  const answer = page.getByRole("article", { name: "Answer" });
  await expect(answer).toContainText("47,407 kWh in April 2024");
  await expect(answer).toContainText("Adani commercial electricity bill");
  await expect(answer).toContainText("Page 1");
  await expect(answer.getByText("“Units Consumed 47407”")).toBeVisible();
  await expect(answer.getByText("Found", { exact: true })).toBeVisible();
});
