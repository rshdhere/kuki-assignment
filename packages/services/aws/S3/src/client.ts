import { S3Client } from "@aws-sdk/client-s3";

// Credentials come from the default AWS provider chain (env vars, profile, IAM role).
export const s3 = new S3Client({
  region: process.env.AWS_REGION,
  // With the default ("WHEN_SUPPORTED") presigned PUTs carry a CRC32 of an
  // empty body, so S3 rejects every real upload with a checksum mismatch.
  requestChecksumCalculation: "WHEN_REQUIRED",
});
