import { config } from "@kuki/config";
import * as schema from "@kuki/drizzle/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// postgres.js connects lazily, so importing this doesn't need a running database.
export const sql = postgres(config.databaseUrl, { max: 10, prepare: false });

export const db = drizzle(sql, { schema, casing: "snake_case" });

export type Db = typeof db;
/** A transaction or the db itself, for functions that work in either. */
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/** True for a Postgres unique violation, optionally on a specific constraint. */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  // Drizzle wraps driver errors; the postgres.js error is on `cause`.
  for (let e: unknown = err; e; e = (e as { cause?: unknown }).cause) {
    const pg = e as { code?: string; constraint_name?: string };
    if (pg.code === "23505")
      return !constraint || pg.constraint_name === constraint;
  }
  return false;
}
