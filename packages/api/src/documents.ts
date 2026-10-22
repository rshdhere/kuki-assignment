import {
  getDocument,
  listDocuments,
  listEvents,
} from "@kuki/controllers/documents";
import { validate } from "@kuki/validators";
import {
  documentParamsSchema,
  listDocumentsQuerySchema,
  listEventsQuerySchema,
} from "@kuki/validators/documents";
import { Router } from "express";

export const documentsRouter = Router();

documentsRouter.get(
  "/",
  validate({ query: listDocumentsQuerySchema }),
  listDocuments,
);
documentsRouter.get(
  "/:id",
  validate({ params: documentParamsSchema }),
  getDocument,
);

export const eventsRouter = Router();

eventsRouter.get("/", validate({ query: listEventsQuerySchema }), listEvents);
