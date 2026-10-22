import { completeUpload, createUploads } from "@kuki/controllers/uploads";
import { validate } from "@kuki/validators";
import {
  createUploadsSchema,
  uploadParamsSchema,
} from "@kuki/validators/uploads";
import { Router } from "express";

export const uploadsRouter = Router();

uploadsRouter.post("/", validate({ body: createUploadsSchema }), createUploads);
uploadsRouter.post(
  "/:uploadId/complete",
  validate({ params: uploadParamsSchema }),
  completeUpload,
);
