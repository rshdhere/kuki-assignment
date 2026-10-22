import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openApiSpecPath } from "@kuki/openapi";

const require = createRequire(import.meta.url);
const swaggerDirectory = dirname(
  require.resolve("swagger-ui-dist/package.json"),
);
const publicDirectory = fileURLToPath(new URL("../public/", import.meta.url));
const assetsDirectory = join(publicDirectory, "swagger-ui");
await mkdir(assetsDirectory, { recursive: true });
await Promise.all(
  ["swagger-ui.css", "swagger-ui-bundle.js"].map((asset) =>
    copyFile(join(swaggerDirectory, asset), join(assetsDirectory, asset)),
  ),
);

const spec = await readFile(openApiSpecPath, "utf8");
const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.argv.includes("--dev") ? "http://localhost:4000" : "/api");
await writeFile(
  join(publicDirectory, "openapi.yaml"),
  spec.replace("url: http://localhost:4000", `url: ${JSON.stringify(apiUrl)}`),
);
