import { readFile } from "node:fs/promises";
import { openApiSpecPath } from "@kuki/openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { Hono } from "hono";

export const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/openapi.yaml", async (c) => {
  const spec = await readFile(openApiSpecPath, "utf8");
  return c.body(spec, 200, { "Content-Type": "application/yaml" });
});

app.get("/docs", swaggerUI({ url: "/openapi.yaml" }));
