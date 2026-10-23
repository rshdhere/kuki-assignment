// Manual probe: real temporary AWS queues + local Postgres + actual worker OS
// processes. Only the AI HTTP response is controlled to inject failures.
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import {
  ChangeMessageVisibilityCommand,
  CreateQueueCommand,
  DeleteMessageCommand,
  DeleteQueueCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
  StartMessageMoveTaskCommand,
} from "@aws-sdk/client-sqs";
import { db, sql } from "@kuki/drizzle";
import { documents } from "@kuki/drizzle/schema";
import { ensureDatabase, migrateDatabase } from "@kuki/drizzle/seed";
import type { ExtractionJob } from "@kuki/types";
import { eq } from "drizzle-orm";
import { extraction } from "@/helpers";

const databaseUrl = process.env.DATABASE_URL!;
assert.equal(new URL(databaseUrl).hostname, "localhost");
assert.equal(new URL(databaseUrl).pathname, "/kuki_reliability_probe");
const sqs = new SQSClient({ region: process.env.AWS_REGION ?? "ap-south-1" });
const prefix = `kuki-verification-${Date.now()}`;
const queues: string[] = [];
const results: Record<string, unknown> = { ran_at: new Date().toISOString() };
let worker: ChildProcess | undefined;
let workerExited: Promise<unknown> | undefined;
let phase: "crash" | "retry" = "crash";
let calls = 0;
const server = createServer((req, res) => {
  req.resume();
  calls++;
  if (phase === "crash" && calls === 1) return;
  const transient = phase === "retry" && calls === 1;
  res.writeHead(transient ? 503 : 200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify(
      transient
        ? { message: "injected outage", retryable: true }
        : extraction(),
    ),
  );
});

async function until(check: () => Promise<boolean>, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(500);
  }
  throw new Error("Timed out waiting for probe condition");
}

function startWorker(queueUrl: string, aiUrl: string) {
  worker = spawn(
    "bun",
    [
      "run",
      fileURLToPath(
        new URL("../../../apps/worker/src/index.ts", import.meta.url),
      ),
    ],
    {
      cwd: fileURLToPath(new URL("../../..", import.meta.url)),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        AWS_SQS_QUEUE_URL: queueUrl,
        AI_SERVICE_URL: aiUrl,
        AI_TIMEOUT_MS: "20000",
        WORKER_CONCURRENCY: "1",
      },
      stdio: "pipe",
    },
  );
  worker.stdout!.resume();
  worker.stderr!.resume();
  workerExited = once(worker, "exit");
}

async function stopWorker(signal: NodeJS.Signals) {
  if (worker && worker.exitCode === null && worker.signalCode === null) {
    worker.kill(signal);
    await workerExited;
  }
  worker = undefined;
}

async function enqueue(queueUrl: string) {
  const id = randomUUID();
  const sha256 = createHash("sha256").update(id).digest("hex");
  await db.insert(documents).values({
    id,
    filename: "queue-probe.pdf",
    contentType: "application/pdf",
    size: 1,
    sha256,
    status: "queued",
    bucket: "probe",
    s3Key: `uploads/${id}`,
  });
  const job: ExtractionJob = {
    type: "document.uploaded",
    uploadId: id,
    bucket: "probe",
    key: `uploads/${id}`,
    filename: "queue-probe.pdf",
    contentType: "application/pdf",
    size: 1,
    sha256,
    uploadedAt: new Date().toISOString(),
  };
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(job),
    }),
  );
  return id;
}

async function status(id: string) {
  return (await db.select().from(documents).where(eq(documents.id, id)))[0];
}

async function arn(url: string) {
  const r = await sqs.send(
    new GetQueueAttributesCommand({
      QueueUrl: url,
      AttributeNames: ["QueueArn"],
    }),
  );
  return r.Attributes!.QueueArn!;
}

try {
  await ensureDatabase(databaseUrl);
  await migrateDatabase(databaseUrl);
  const dlq = (
    await sqs.send(
      new CreateQueueCommand({
        QueueName: `${prefix}-dlq`,
        Attributes: { VisibilityTimeout: "5" },
      }),
    )
  ).QueueUrl!;
  queues.push(dlq);
  const dlqArn = await arn(dlq);
  const main = (
    await sqs.send(
      new CreateQueueCommand({
        QueueName: prefix,
        Attributes: {
          VisibilityTimeout: "5",
          ReceiveMessageWaitTimeSeconds: "1",
          RedrivePolicy: JSON.stringify({
            deadLetterTargetArn: dlqArn,
            maxReceiveCount: 10,
          }),
        },
      }),
    )
  ).QueueUrl!;
  queues.push(main);
  const mainArn = await arn(main);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  const aiUrl = `http://127.0.0.1:${address.port}`;

  const crashId = await enqueue(main);
  startWorker(main, aiUrl);
  await until(
    async () => calls === 1 && (await status(crashId))?.status === "extracting",
  );
  await stopWorker("SIGKILL");
  assert.equal((await status(crashId))?.status, "extracting");
  startWorker(main, aiUrl);
  await until(async () => (await status(crashId))?.status === "succeeded");
  const recovered = await status(crashId);
  assert.equal(recovered?.factCount, 2);
  assert((recovered?.attempts ?? 0) >= 2);
  results.worker_sigkill_recovery = {
    passed: true,
    attempts: recovered?.attempts,
    fact_count: recovered?.factCount,
  };
  console.log("PASS real SQS redelivery after worker SIGKILL");
  // Let deletion of the successful delivery finish before the next scenario.
  await sleep(1000);

  phase = "retry";
  calls = 0;
  const retryId = await enqueue(main);
  await until(async () => (await status(retryId))?.status === "retrying");
  const retryStart = Date.now();
  await until(async () => (await status(retryId))?.status === "succeeded");
  const retried = await status(retryId);
  assert.equal(retried?.lastError, null);
  assert((retried?.attempts ?? 0) >= 2);
  results.transient_retry = {
    passed: true,
    attempts: retried?.attempts,
    seconds_after_retrying: (Date.now() - retryStart) / 1000,
  };
  console.log("PASS real SQS 503 retry with worker backoff");
  await sleep(1000);
  await stopWorker("SIGTERM");
  results.graceful_shutdown = { passed: true };

  const body = `redrive-verification-${randomUUID()}`;
  await sqs.send(new SendMessageCommand({ QueueUrl: main, MessageBody: body }));
  const counts: number[] = [];
  for (let i = 0; i < 10; i++) {
    let found = false;
    await until(async () => {
      const r = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: main,
          WaitTimeSeconds: 1,
          MessageSystemAttributeNames: ["ApproximateReceiveCount"],
        }),
      );
      const m = r.Messages?.find((m) => m.Body === body);
      if (!m) return false;
      counts.push(Number(m.Attributes?.ApproximateReceiveCount));
      await sqs.send(
        new ChangeMessageVisibilityCommand({
          QueueUrl: main,
          ReceiptHandle: m.ReceiptHandle!,
          VisibilityTimeout: 0,
        }),
      );
      found = true;
      return true;
    }, 20000);
    assert(found);
  }
  // A receive on the source triggers the move once maxReceiveCount is reached.
  await sqs.send(
    new ReceiveMessageCommand({ QueueUrl: main, WaitTimeSeconds: 1 }),
  );
  await until(async () => {
    const r = await sqs.send(
      new ReceiveMessageCommand({ QueueUrl: dlq, WaitTimeSeconds: 1 }),
    );
    const m = r.Messages?.find((m) => m.Body === body);
    if (!m) return false;
    await sqs.send(
      new ChangeMessageVisibilityCommand({
        QueueUrl: dlq,
        ReceiptHandle: m.ReceiptHandle!,
        VisibilityTimeout: 0,
      }),
    );
    return true;
  });
  assert.deepEqual(
    counts,
    Array.from({ length: 10 }, (_, i) => i + 1),
  );
  results.dead_letter_after_ten_receives = {
    passed: true,
    receive_counts: counts,
  };
  console.log("PASS real SQS DLQ after ten receives");

  await sqs.send(
    new StartMessageMoveTaskCommand({
      SourceArn: dlqArn,
      DestinationArn: mainArn,
      MaxNumberOfMessagesPerSecond: 1,
    }),
  );
  await until(async () => {
    const r = await sqs.send(
      new ReceiveMessageCommand({ QueueUrl: main, WaitTimeSeconds: 1 }),
    );
    const m = r.Messages?.find((m) => m.Body === body);
    if (!m) return false;
    await sqs.send(
      new DeleteMessageCommand({
        QueueUrl: main,
        ReceiptHandle: m.ReceiptHandle!,
      }),
    );
    return true;
  });
  results.native_dlq_redrive = { passed: true };
  console.log("PASS AWS native DLQ redrive back to source");
} catch (err) {
  results.error =
    err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  process.exitCode = 1;
  console.error(results.error);
} finally {
  await stopWorker("SIGKILL");
  server.closeAllConnections();
  if (server.listening)
    await new Promise<void>((resolve) => server.close(() => resolve()));
  const cleanup = await Promise.allSettled(
    queues.map((QueueUrl) => sqs.send(new DeleteQueueCommand({ QueueUrl }))),
  );
  results.temporary_queue_cleanup = cleanup.every(
    (r) => r.status === "fulfilled",
  );
  await sql.end();
  sqs.destroy();
  writeFileSync(
    fileURLToPath(
      new URL(
        "../../../docs/queue-reliability-2026-10-23.json",
        import.meta.url,
      ),
    ),
    JSON.stringify(results, null, 2) + "\n",
  );
}
