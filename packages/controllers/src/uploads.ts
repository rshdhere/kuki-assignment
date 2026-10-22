import * as uploads from "@kuki/handlers/uploads";
import { UploadNotFoundError } from "@kuki/handlers/errors";
import type { UploadRequestFile } from "@kuki/types";
import type { RequestHandler } from "express";

/** POST /uploads: one slot per file, in request order: a presigned PUT, or a duplicate to skip. */
export const createUploads: RequestHandler = async (req, res) => {
  const { files } = req.body as { files: UploadRequestFile[] };
  const created = await uploads.createUploads(files);
  res.status(201).json({ uploads: created });
};

/** POST /uploads/:uploadId/complete: queue an uploaded file for extraction. */
export const completeUpload: RequestHandler<{ uploadId: string }> = async (
  req,
  res,
) => {
  try {
    res.status(202).json(await uploads.completeUpload(req.params.uploadId));
  } catch (err) {
    if (err instanceof UploadNotFoundError) {
      res.status(404).json({
        error: "upload_not_found",
        message: "Nothing has been uploaded for this id yet",
      });
      return;
    }
    throw err;
  }
};
