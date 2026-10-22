import { db } from "@kuki/drizzle";
import { documents } from "@kuki/drizzle/schema";
import { recordEvent } from "@kuki/handlers/events";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "server/app";
import { sha } from "@/helpers";

const seed = async (n: number) => {
  const ids = Array.from({ length: n }, () => crypto.randomUUID());
  await db.insert(documents).values(
    ids.map((id, i) => ({
      id,
      filename: `doc-${i}.pdf`,
      contentType: "application/pdf",
      size: 100 + i,
      sha256: sha(i.toString(16)),
      status: "awaiting_upload" as const,
      createdAt: new Date(Date.UTC(2026, 9, 22, 10, i)),
    })),
  );
  return ids;
};

describe("GET /documents", () => {
  it("lists documents newest first", async () => {
    await seed(3);

    const res = await request(app).get("/documents");

    expect(res.status).toBe(200);
    expect(
      res.body.documents.map((d: { filename: string }) => d.filename),
    ).toEqual(["doc-2.pdf", "doc-1.pdf", "doc-0.pdf"]);
    expect(res.body.documents[0]).toMatchObject({
      status: "awaiting_upload",
      size: 102,
      attempts: 0,
      createdAt: "2026-10-22T10:02:00.000Z",
    });
    expect(res.body.nextBefore).toBeNull();
  });

  it("pages with limit and before", async () => {
    await seed(5);

    const page1 = await request(app).get("/documents?limit=2");
    expect(page1.body.documents).toHaveLength(2);
    expect(page1.body.nextBefore).toBe("2026-10-22T10:03:00.000Z");

    const page2 = await request(app).get(
      `/documents?limit=2&before=${page1.body.nextBefore}`,
    );
    expect(
      page2.body.documents.map((d: { filename: string }) => d.filename),
    ).toEqual(["doc-2.pdf", "doc-1.pdf"]);
  });

  it("rejects a bad limit", async () => {
    const res = await request(app).get("/documents?limit=0");

    expect(res.status).toBe(400);
    expect(res.body.issues[0].path).toBe("query.limit");
  });
});

describe("GET /documents/:id", () => {
  it("returns the document with its events, oldest first", async () => {
    const [id = ""] = await seed(1);
    await recordEvent(db, id, "upload_started", "doc-0.pdf upload started.");
    await recordEvent(db, id, "queued", "doc-0.pdf queued for extraction.");

    const res = await request(app).get(`/documents/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.document.id).toBe(id);
    expect(res.body.events.map((e: { type: string }) => e.type)).toEqual([
      "upload_started",
      "queued",
    ]);
  });

  it("returns 404 for an unknown id and 400 for a malformed one", async () => {
    expect(
      (await request(app).get(`/documents/${crypto.randomUUID()}`)).status,
    ).toBe(404);
    expect((await request(app).get("/documents/nope")).status).toBe(400);
  });
});

describe("GET /events", () => {
  it("returns the latest events across documents, newest first", async () => {
    const [a = "", b = ""] = await seed(2);
    await recordEvent(db, a, "upload_started", "first");
    await recordEvent(db, b, "duplicate", "second");

    const res = await request(app).get("/events?limit=1");

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0]).toMatchObject({
      documentId: b,
      message: "second",
    });
  });
});
