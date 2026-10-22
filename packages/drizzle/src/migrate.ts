import { fileURLToPath } from "node:url";
import type { Db } from "@kuki/drizzle/client";
import { migrate } from "drizzle-orm/postgres-js/migrator";

export const migrationsFolder = fileURLToPath(
  new URL("../migrations", import.meta.url),
);

/** Applies any pending migrations from `migrations/`. */
export async function runMigrations(db: Db) {
  await migrate(db, { migrationsFolder });
}
