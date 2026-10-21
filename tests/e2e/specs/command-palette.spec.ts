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

test("facts are searchable by value", async ({ page }) => {
  await page.goto("/");
  await openPalette(page);

  await page.getByRole("combobox").fill("billing period");
  await page.getByRole("option", { name: /Billing period/ }).click();
  await expect(page).toHaveURL(/\/facts$/);
});

test("shows an empty state", async ({ page }) => {
  await page.goto("/");
  await openPalette(page);

  await page.getByRole("combobox").fill("zzzz");
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(page.getByText("No results for")).toBeVisible();
});
