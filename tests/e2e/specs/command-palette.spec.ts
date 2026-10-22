import { expect, test, type Page } from "@playwright/test";

const shortcut = process.platform === "darwin" ? "Meta+K" : "Control+K";

// The shortcut listener attaches on hydration, so retry until the palette shows.
async function openPalette(page: Page) {
  const palette = page.getByRole("dialog", { name: "Search" });
  await expect(async () => {
    if (!(await palette.isVisible())) await page.keyboard.press(shortcut);
    await expect(palette).toBeVisible({ timeout: 500 });
  }).toPass();
  return palette;
}

test("keyboard shortcut opens the palette and Escape closes it", async ({
  page,
}) => {
  await page.goto("/");
  const palette = await openPalette(page);
  await expect(page.getByRole("combobox")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
});

test("search button opens the palette", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("complementary", { name: "Sidebar" })
    .getByRole("button", { name: /Search/ })
    .click();
  await expect(page.getByRole("dialog", { name: "Search" })).toBeVisible();
});

test("typing filters results and Enter navigates", async ({ page }) => {
  await page.goto("/");
  await openPalette(page);

  await page.getByRole("combobox").fill("financial");
  const options = page.getByRole("option");
  await expect(options).toHaveCount(1);
  await expect(options.first()).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/financial-year$/);
  await expect(page.getByRole("dialog", { name: "Search" })).toBeHidden();
});

test("arrow keys move the selection", async ({ page }) => {
  await page.goto("/");
  await openPalette(page);

  const options = page.getByRole("option");
  await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(options.last()).toHaveAttribute("aria-selected", "true");
});

test("processed documents open their facts", async ({ page }) => {
  const id = "11111111-1111-4111-8111-111111111111";
  await page.route("http://localhost:4000/documents?*", (route) =>
    route.fulfill({
      json: {
        documents: [
          {
            id,
            filename: "BESCOM Commercial Electricity Bill.pdf",
            contentType: "application/pdf",
            size: 1000,
            sha256: "b".repeat(64),
            status: "succeeded",
            duplicateOf: null,
            attempts: 1,
            lastError: null,
            docType: "electricity_bill",
            organisation: null,
            periodStart: null,
            periodEnd: null,
            pageCount: 2,
            factCount: 0,
            issues: [],
            createdAt: "2026-10-22T00:00:00.000Z",
          },
        ],
      },
    }),
  );
  await page.goto("/");
  await openPalette(page);

  await page.getByRole("combobox").fill("bescom");
  await page.getByRole("option", { name: /BESCOM/ }).click();
  await expect(page).toHaveURL(new RegExp(`/facts\\?id=${id}$`));
});

test("shows an empty state", async ({ page }) => {
  await page.goto("/");
  await openPalette(page);

  await page.getByRole("combobox").fill("zzzz");
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(page.getByText("No results for")).toBeVisible();
});
