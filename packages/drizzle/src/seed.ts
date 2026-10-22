// Sets up the local databases: creates any that are missing, then applies
// migrations. Safe to run any number of times.
//
//   bun run db:seed
//
// Done here rather than in a docker-entrypoint-initdb.d script, which only
// runs when the Postgres volume is first created.

import { config } from "@kuki/config";
import { migrationsFolder } from "@kuki/drizzle/migrate";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/** The same server and credentials, connected to a different database. */
export function withDatabase(url: string, name: string): string {
  const u = new URL(url);
  u.pathname = `/${name}`;
  return u.toString();
}

const databaseName = (url: string) =>
  decodeURIComponent(new URL(url).pathname.slice(1));

/** Defaults to the dev database's name plus `_test` (`kuki_test`). */
export const testDatabaseUrl = (devUrl = config.databaseUrl) =>
  process.env.TEST_DATABASE_URL ??
  withDatabase(devUrl, `${databaseName(devUrl)}_test`);

/** Creates the database in `url` if it doesn't exist. Returns true if it did. */
export async function ensureDatabase(url: string): Promise<boolean> {
  const name = databaseName(url);
  // Every Postgres server has the `postgres` maintenance database.
  const admin = postgres(withDatabase(url, "postgres"), {
    max: 1,
    onnotice: () => {},
  });
  try {
    const [exists] =
      await admin`select 1 from pg_database where datname = ${name}`;
    if (exists) return false;
    await admin`create database ${admin(name)}`;
    return true;
  } finally {
    await admin.end();
  }
}

/** Applies pending migrations to the database in `url`. */
export async function migrateDatabase(url: string) {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder });
  } finally {
    await sql.end();
  }
}

/** Creates (if needed) and migrates each database. */
export async function seed(urls: string[]) {
  for (const url of urls) {
    const name = databaseName(url);
    const created = await ensureDatabase(url);
    await migrateDatabase(url);
    console.log(`[seed] ${name}: ${created ? "created and " : ""}migrated`);
  }
}

if (import.meta.main) {
  await seed([config.databaseUrl, testDatabaseUrl()]);
}
