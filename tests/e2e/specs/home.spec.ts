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
