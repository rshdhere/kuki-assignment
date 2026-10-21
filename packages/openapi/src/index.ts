import { fileURLToPath } from "node:url";

// Absolute path to the hand-written OpenAPI spec.
export const openApiSpecPath = fileURLToPath(
  new URL("../openapi.yaml", import.meta.url),
);
