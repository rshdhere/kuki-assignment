import { expect, test } from "@playwright/test";

test("documents page renders", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Documents" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Upload files" }),
  ).toBeVisible();
});

test("upload shows a queued toast", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Upload files" }).click();
  await expect(page.getByRole("status")).toContainText("3 files queued");
});

test("sidebar reaches every screen", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Workspace" });

  for (const [label, heading] of [
    ["Extracted facts", "Adani commercial electricity bill"],
    ["Ask", null],
    ["Financial year", "FY 2026-27"],
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

test("picking a calculated fact explains there is nothing to highlight", async ({
  page,
}) => {
  await page.goto("/facts");

  await page.getByRole("button", { name: "Calculated" }).click();
  await page.getByRole("button", { name: "Average per day" }).click();
  await expect(page.getByText('"Average per day" is calculated')).toBeVisible();
});

test("select all checks every row and updates the count", async ({ page }) => {
  await page.goto("/");
  const table = page.getByRole("region", { name: "Processing queue" });
  const selectAll = table.getByRole("checkbox", { name: "Select all" });
  const rows = table.getByRole("checkbox", { name: /^Select (?!all)/ });
  const footer = table.getByText(/rows selected/);

  await expect(rows).toHaveCount(7);
  await expect(footer).toContainText("0 of 7");

  await selectAll.check();
  for (const row of await rows.all()) await expect(row).toBeChecked();
  await expect(footer).toContainText("7 of 7");

  // Unchecking one row leaves the header in the mixed state.
  await rows.first().uncheck();
  await expect(selectAll).not.toBeChecked();
  expect(
    await selectAll.evaluate((el: HTMLInputElement) => el.indeterminate),
  ).toBe(true);
  await expect(footer).toContainText("6 of 7");

  // From the mixed state, the header selects everything again.
  await selectAll.check();
  await expect(footer).toContainText("7 of 7");

  await selectAll.uncheck();
  for (const row of await rows.all()) await expect(row).not.toBeChecked();
  await expect(footer).toContainText("0 of 7");
});

test("checking every row checks select all", async ({ page }) => {
  await page.goto("/");
  const table = page.getByRole("region", { name: "Processing queue" });
  const rows = table.getByRole("checkbox", { name: /^Select (?!all)/ });

  for (const row of await rows.all()) await row.check();
  await expect(
    table.getByRole("checkbox", { name: "Select all" }),
  ).toBeChecked();
});
