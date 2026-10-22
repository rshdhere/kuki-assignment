// Browser side of the upload pipeline:
// POST /uploads (presign) → PUT each file to S3 → POST /uploads/:id/complete (queue).

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Browsers often leave `File.type` empty for CSV and XLSX, so go by extension.
const contentTypes: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
};

export const ACCEPT = Object.keys(contentTypes)
  .map((ext) => `.${ext}`)
  .join(",");

export interface UploadOutcome {
  queued: string[];
  /** Content already in the system; not uploaded again. */
  duplicates: string[];
  failed: { file: string; reason: string }[];
}

type UploadSlot =
  | {
      status: "upload";
      uploadId: string;
      url: string;
      method: "PUT";
      headers: Record<string, string>;
    }
  | { status: "duplicate"; uploadId: string };

function contentTypeFor(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return contentTypes[ext];
}

async function sha256Hex(file: File) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed with ${res.status}`);
  return res.json() as Promise<T>;
}

export async function uploadFiles(files: File[]): Promise<UploadOutcome> {
  const outcome: UploadOutcome = { queued: [], duplicates: [], failed: [] };

  const accepted: { file: File; contentType: string }[] = [];
  for (const file of files) {
    const contentType = contentTypeFor(file);
    if (!contentType)
      outcome.failed.push({
        file: file.name,
        reason: "Not a PDF, XLSX or CSV",
      });
    else if (file.size === 0)
      outcome.failed.push({ file: file.name, reason: "File is empty" });
    else if (file.size > MAX_UPLOAD_BYTES)
      outcome.failed.push({ file: file.name, reason: "Larger than 25 MB" });
    else accepted.push({ file, contentType });
  }
  if (accepted.length === 0) return outcome;

  const described = await Promise.all(
    accepted.map(async ({ file, contentType }) => ({
      filename: file.name,
      contentType,
      size: file.size,
      sha256: await sha256Hex(file),
    })),
  );

  let uploads: UploadSlot[];
  try {
    ({ uploads } = await api<{ uploads: UploadSlot[] }>("/uploads", {
      files: described,
    }));
  } catch {
    for (const { file } of accepted)
      outcome.failed.push({ file: file.name, reason: "Server unavailable" });
    return outcome;
  }

  // The server returns one slot per file, in request order.
  await Promise.all(
    accepted.map(async ({ file }, i) => {
      const upload = uploads[i];
      if (!upload) return;
      if (upload.status === "duplicate") {
        outcome.duplicates.push(file.name);
        return;
      }
      try {
        const put = await fetch(upload.url, {
          method: upload.method,
          headers: upload.headers,
          body: file,
        });
        if (!put.ok) throw new Error(`S3 responded ${put.status}`);
        const done = await api<{ status: string }>(
          `/uploads/${upload.uploadId}/complete`,
        );
        // Another upload of the same content can win the race to be queued.
        if (done.status === "duplicate") outcome.duplicates.push(file.name);
        else outcome.queued.push(file.name);
      } catch {
        outcome.failed.push({ file: file.name, reason: "Upload failed" });
      }
    }),
  );
  return outcome;
}
