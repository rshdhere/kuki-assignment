import { DEFAULT_CONCURRENCY, runConsumer } from "@/consumer";
import { sql } from "@kuki/drizzle";

const queueUrl = process.env.AWS_SQS_QUEUE_URL;
if (!queueUrl) {
  // Exit cleanly so `bun run dev` keeps the other apps running without AWS set up.
  console.warn("[worker] AWS_SQS_QUEUE_URL is not set, not starting");
  process.exit(0);
}

const controller = new AbortController();
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.once(sig, () => {
    console.log(`[worker] ${sig}: finishing in-flight jobs`);
    controller.abort();
  });
}

const concurrency =
  Number(process.env.WORKER_CONCURRENCY) || DEFAULT_CONCURRENCY;
console.log(`[worker] polling ${queueUrl}, ${concurrency} jobs at a time`);
await runConsumer(queueUrl, controller.signal, concurrency);
// The open connection pool would otherwise keep the process alive.
await sql.end({ timeout: 5 });
console.log("[worker] stopped");
