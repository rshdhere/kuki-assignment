import { readFile } from "node:fs/promises";
import {
  answersRouter,
  evaluationsRouter,
  financialYearRouter,
} from "@kuki/api/answers";
import { documentsRouter, eventsRouter } from "@kuki/api/documents";
import { uploadsRouter } from "@kuki/api/uploads";
import { config } from "@kuki/config";
import { openApiSpecPath } from "@kuki/openapi";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import swaggerUi from "swagger-ui-express";

export const app = express();

app.use(cors({ origin: config.clientOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/uploads", uploadsRouter);
app.use("/documents", documentsRouter);
app.use("/events", eventsRouter);
app.use("/answers", answersRouter);
app.use("/financial-year", financialYearRouter);
app.use("/evaluations", evaluationsRouter);

app.get("/openapi.yaml", async (_req, res) => {
  const spec = await readFile(openApiSpecPath, "utf8");
  res
    .type("application/yaml")
    .send(
      process.env.VERCEL
        ? spec.replace("url: http://localhost:4000", "url: /api")
        : spec,
    );
});

app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(undefined, { swaggerOptions: { url: "/openapi.yaml" } }),
);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
};
app.use(errorHandler);

export default app;
