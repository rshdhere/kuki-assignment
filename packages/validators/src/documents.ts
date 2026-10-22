import { z } from "zod";

export const listDocumentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  /** `createdAt` of the last document on the previous page. */
  before: z.iso.datetime({ offset: true }).optional(),
});

export const listEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const documentParamsSchema = z.object({
  id: z.uuid(),
});
