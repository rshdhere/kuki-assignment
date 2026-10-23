/* eslint-disable turbo/no-undeclared-env-vars -- Deployment-only credentials are consumed outside cached Turbo tasks. */
import { migrateDatabase } from "@kuki/drizzle/seed";

// Deployment must fail rather than silently migrating a default local database.
// Vercel Marketplace provides POSTGRES_*; an explicit DATABASE_URL takes priority.
const url =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_URL;

if (!url) {
  throw new Error(
    "Missing deployment database configuration: set DATABASE_URL or POSTGRES_URL_NON_POOLING/POSTGRES_URL",
  );
}

await migrateDatabase(url);
console.log("Database migrations applied successfully");
