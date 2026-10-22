import { config } from "@kuki/config";
import { z } from "zod";

export const uploadContentTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
] as const;

export const createUploadsSchema = z.object({
  files: z
    .array(
      z.object({
        filename: z.string().trim().min(1).max(255),
        contentType: z.enum(uploadContentTypes),
        size: z.number().int().positive().max(config.uploads.maxBytes),
        sha256: z
          .string()
          .regex(/^[a-f0-9]{64}$/, "Expected a lowercase hex SHA-256"),
      }),
    )
    .min(1)
    .max(20),
});

export const uploadParamsSchema = z.object({
  uploadId: z.uuid(),
});
