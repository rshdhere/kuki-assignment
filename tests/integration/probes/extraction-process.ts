// Separate OS process used to verify recovery after a real SIGKILL.
/* eslint-disable turbo/no-undeclared-env-vars -- Probe inputs are supplied only by the uncached manual/test harness. */
import { sql } from "@kuki/drizzle";
import {
  processExtractionJob,
  recordExtractionFailure,
} from "@kuki/handlers/extraction";
import type { ExtractionJob } from "@kuki/types";

const job = JSON.parse(process.env.PROBE_JOB!) as ExtractionJob;
const attempt = Number(process.env.PROBE_ATTEMPT);
try {
  await processExtractionJob(job, attempt);
} catch (err) {
  await recordExtractionFailure(job.uploadId, attempt, err);
  process.exitCode = 2;
} finally {
  await sql.end();
}
