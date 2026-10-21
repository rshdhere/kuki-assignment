import { openApiSpecPath } from "@kuki/openapi";
import express from "express";
import swaggerUi from "swagger-ui-express";

export const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/openapi.yaml", (_req, res) => {
  res.type("application/yaml").sendFile(openApiSpecPath);
});

app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(undefined, { swaggerOptions: { url: "/openapi.yaml" } }),
);
