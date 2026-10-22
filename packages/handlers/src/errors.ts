export class UploadNotFoundError extends Error {
  constructor(readonly uploadId: string) {
    super(`No uploaded object for upload ${uploadId}`);
    this.name = "UploadNotFoundError";
  }
}

/** Extraction can never succeed for this document, so retrying is pointless. */
export class PermanentExtractionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PermanentExtractionError";
  }
}
