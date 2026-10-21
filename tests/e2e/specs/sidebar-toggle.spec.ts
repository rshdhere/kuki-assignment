import { expect, test } from "@playwright/test";

const shortcut = process.platform === "darwin" ? "Meta+B" : "Control+B";

test("toggle button hides and shows the sidebar", async ({ page }) => {
  await page.goto("/");
  const sidebar = page.getByRole("complementary", { name: "Sidebar" });
  const toggle = page.getByRole("button", { name: "Toggle sidebar" });

  await expect(sidebar).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  await toggle.click();
  await expect(sidebar).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.click();
  await expect(sidebar).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
});

test("keyboard shortcut toggles the sidebar", async ({ page }) => {
  await page.goto("/");
  const sidebar = page.getByRole("complementary", { name: "Sidebar" });

  // The shortcut listener attaches on hydration, so retry until it takes.
  await expect(async () => {
    if (await sidebar.isVisible()) await page.keyboard.press(shortcut);
    await expect(sidebar).toBeHidden({ timeout: 500 });
  }).toPass();

  await page.keyboard.press(shortcut);
  await expect(sidebar).toBeVisible();
});

test("collapsed state survives navigation and reload", async ({ page }) => {
  await page.goto("/");
  const sidebar = page.getByRole("complementary", { name: "Sidebar" });

  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  await expect(sidebar).toBeHidden();

  await page.goto("/facts");
  await expect(sidebar).toBeHidden();

  await page.reload();
  await expect(sidebar).toBeHidden();
});
