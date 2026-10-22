// Values with a sensible dev default are read eagerly. Ones without a default
// throw on first access, so importing this module never requires them.
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  awsRegion: process.env.AWS_REGION ?? "ap-south-1",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
  // Matches compose.yaml.
  databaseUrl:
    process.env.DATABASE_URL ?? "postgres://kuki:kuki@localhost:5432/kuki",
  uploads: {
    bucket:
      process.env.AWS_S3_BUCKET ?? "kuki-evidence-documents-dev-ap-south-1",
    prefix: "uploads/",
    maxBytes: 25 * 1024 * 1024,
    urlExpiresInSeconds: 15 * 60,
  },
  extraction: {
    // Must match maxReceiveCount in the queue's redrive policy.
    maxReceives: 10,
  },
  ai: {
    // The Python service in apps/ai.
    url: process.env.AI_SERVICE_URL ?? "http://localhost:8000",
    // Extraction and answers with tool calls can take a few minutes. Keep this
    // under the queue's visibility timeout so a hung call fails before SQS
    // redelivers the job.
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 240_000),
  },
  get extractionQueueUrl(): string {
    return required("AWS_SQS_QUEUE_URL");
  },
};
