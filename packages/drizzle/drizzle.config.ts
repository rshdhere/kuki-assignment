import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  casing: "snake_case",
  dbCredentials: {
    // Matches compose.yaml.
    url: process.env.DATABASE_URL ?? "postgres://kuki:kuki@localhost:5432/kuki",
  },
});
