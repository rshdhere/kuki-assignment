import * as documents from "@kuki/handlers/documents";
import type { RequestHandler } from "express";

/** GET /documents: newest first, paged by `before`. */
export const listDocuments: RequestHandler = async (req, res) => {
  const { limit, before } = req.query as unknown as {
    limit: number;
    before?: string;
  };
  const items = await documents.listDocuments({
    limit,
    before: before ? new Date(before) : undefined,
  });
  const last = items.at(-1);
  res.json({
    documents: items,
    nextBefore: items.length === limit && last ? last.createdAt : null,
  });
};

/** GET /documents/:id: the document and its events. */
export const getDocument: RequestHandler<{ id: string }> = async (req, res) => {
  const found = await documents.getDocument(req.params.id);
  if (!found) {
    res.status(404).json({ error: "document_not_found" });
    return;
  }
  res.json(found);
};

/** GET /events: the activity feed across all documents. */
export const listEvents: RequestHandler = async (req, res) => {
  const { limit } = req.query as unknown as { limit: number };
  res.json({ events: await documents.listEvents({ limit }) });
};
