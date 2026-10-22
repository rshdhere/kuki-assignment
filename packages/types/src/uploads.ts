export type UploadContentType =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  | "text/csv";

export interface UploadRequestFile {
  filename: string;
  contentType: UploadContentType;
  size: number;
  /** Hex SHA-256 of the file, computed by the client. */
  sha256: string;
}

export interface PresignedUpload {
  status: "upload";
  uploadId: string;
  key: string;
  url: string;
  method: "PUT";
  /** Headers the client must send with the PUT; they are part of the signature. */
  headers: Record<string, string>;
  expiresAt: string;
}

/** A file whose content is already in the system; nothing to upload. */
export interface DuplicateUpload {
  status: "duplicate";
  uploadId: string;
  duplicateOf: string;
}

export type UploadSlot = PresignedUpload | DuplicateUpload;

export interface CompleteUploadResult {
  uploadId: string;
  status: "queued" | "duplicate" | "already_completed";
  filename: string;
  size: number;
}

/** Body of a message on the document extraction queue. */
export interface ExtractionJob {
  type: "document.uploaded";
  uploadId: string;
  bucket: string;
  key: string;
  filename: string;
  contentType: string;
  size: number;
  sha256: string;
  uploadedAt: string;
}
