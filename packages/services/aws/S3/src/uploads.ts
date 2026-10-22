import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "@kuki/s3/client";

export interface PresignPutInput {
  bucket: string;
  key: string;
  contentType: string;
  /** Exact byte length; signed, so S3 rejects a body of any other size. */
  contentLength: number;
  /** User metadata (x-amz-meta-*). Values must be ASCII. */
  metadata: Record<string, string>;
  expiresIn: number;
}

/**
 * Presigns a PUT the browser can send straight to S3. Content type, length and
 * metadata are signed headers, so the client must send exactly these values.
 */
export async function presignPut(input: PresignPutInput) {
  const metadataHeaders = Object.fromEntries(
    Object.entries(input.metadata).map(([k, v]) => [`x-amz-meta-${k}`, v]),
  );
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
      Metadata: input.metadata,
    }),
    {
      expiresIn: input.expiresIn,
      // Keep metadata in headers rather than the query string so it is signed
      // as headers and the browser has to send it.
      unhoistableHeaders: new Set(Object.keys(metadataHeaders)),
      signableHeaders: new Set(["content-type"]),
    },
  );
  return {
    url,
    headers: { "Content-Type": input.contentType, ...metadataHeaders },
  };
}

/** Returns the object's size, type and metadata, or null if it doesn't exist. */
export async function headObject(bucket: string, key: string) {
  try {
    const res = await s3.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );
    return {
      size: res.ContentLength ?? 0,
      contentType: res.ContentType,
      metadata: res.Metadata ?? {},
      lastModified: res.LastModified,
    };
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === "NotFound" || err.name === "NoSuchKey")
    )
      return null;
    throw err;
  }
}
