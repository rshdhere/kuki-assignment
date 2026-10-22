import { expect, test } from "@playwright/test";

test("Swagger docs render the shared OpenAPI spec on the Next.js origin", async ({
  page,
  request,
}) => {
  const spec = await request.get("/openapi.yaml");
  expect(spec.ok()).toBeTruthy();
  expect(await spec.text()).toContain("openapi: 3.1.0");

  for (const path of ["/docs", "/docs/"]) {
    await page.goto(path);
    await expect(page.locator(".swagger-ui .info .title")).toContainText(
      "KuKi Evidence API",
    );
    await expect(page.locator(".opblock-summary-path").first()).toBeVisible();
    await expect(page.getByText("Failed to load API definition")).toHaveCount(
      0,
    );
  }
});
