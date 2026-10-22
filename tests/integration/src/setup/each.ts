import { sql } from "@kuki/drizzle";
import { afterAll, beforeEach } from "vitest";

beforeEach(async () => {
  await sql`truncate answers, facts, document_segments, document_events, documents restart identity cascade`;
});

afterAll(async () => {
  await sql.end();
});
