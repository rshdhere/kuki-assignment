import { ensureDatabase, migrateDatabase } from "@kuki/drizzle/seed";

export async function setup() {
  const url = process.env.TEST_DATABASE_URL!;
  try {
    await ensureDatabase(url);
    await migrateDatabase(url);
  } catch (err) {
    throw new Error(
      `Could not set up ${url}. Is Postgres running? (bun run db:up)`,
      { cause: err },
    );
  }
}
