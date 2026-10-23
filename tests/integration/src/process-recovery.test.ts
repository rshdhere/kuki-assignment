import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { db } from "@kuki/drizzle";
import { documentSegments, documents, facts } from "@kuki/drizzle/schema";
import type { ExtractionJob } from "@kuki/types";
import { eq } from "drizzle-orm";
import { afterEach, expect, it, vi } from "vitest";
import { extraction, getDoc, sha } from "@/helpers";

const id = "b535c393-96d3-4497-8b16-7bb92c32a9aa";
const job: ExtractionJob = {
  type: "document.uploaded",
  uploadId: id,
  bucket: "test",
  key: `uploads/${id}`,
  filename: "recovery.pdf",
  contentType: "application/pdf",
  size: 1,
  sha256: sha("c"),
  uploadedAt: "2026-10-23T00:00:00.000Z",
};
const children: ChildProcess[] = [];
const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  for (const child of children.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
    }
  }
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

async function seed() {
  await db.insert(documents).values({
    id,
    filename: job.filename,
    contentType: job.contentType,
    size: 1,
    sha256: job.sha256,
    status: "queued",
    bucket: job.bucket,
    s3Key: job.key,
  });
}

async function aiServer(handle: (res: ServerResponse) => void) {
  const server = createServer((req, res) => {
    req.resume();
    handle(res);
  });
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  return `http://127.0.0.1:${address.port}`;
}

function start(url: string, attempt: number) {
  const child = spawn(
    "bun",
    [
      "run",
      fileURLToPath(
        new URL("../probes/extraction-process.ts", import.meta.url),
      ),
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: process.env.TEST_DATABASE_URL!,
        AI_SERVICE_URL: url,
        AI_TIMEOUT_MS: "10000",
        PROBE_JOB: JSON.stringify(job),
        PROBE_ATTEMPT: String(attempt),
      },
      stdio: "pipe",
    },
  );
  children.push(child);
  let stderr = "";
  child.stderr!.on("data", (data: Buffer) => (stderr += data.toString()));
  const exited = new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== 0 && code !== 2 && child.signalCode !== "SIGKILL")
        reject(new Error(`Probe exited ${code}: ${stderr}`));
      else resolve(code);
    });
  });
  return { child, exited };
}

function success(res: ServerResponse) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(extraction()));
}

it("recovers after SIGKILL during extraction and retains results across process restarts", async () => {
  await seed();
  let calls = 0;
  const url = await aiServer((res) => {
    calls++;
    if (calls > 1) success(res); // Hold the first request until its worker dies.
  });
  const first = start(url, 1);
  await vi.waitFor(() => expect(calls).toBe(1), { timeout: 5000 });
  expect((await getDoc(id))?.status).toBe("extracting");
  first.child.kill("SIGKILL");
  await first.exited;
  expect((await getDoc(id))?.status).toBe("extracting");

  expect(await start(url, 2).exited).toBe(0);
  expect(await getDoc(id)).toMatchObject({ status: "succeeded", attempts: 2 });
  expect(
    await db.select().from(facts).where(eq(facts.documentId, id)),
  ).toHaveLength(2);
  expect(
    await db
      .select()
      .from(documentSegments)
      .where(eq(documentSegments.documentId, id)),
  ).toHaveLength(1);

  // Third, fresh process sees durable success and skips a redelivered job.
  expect(await start(url, 3).exited).toBe(0);
  expect(calls).toBe(2);
  expect(await getDoc(id)).toMatchObject({
    status: "succeeded",
    attempts: 2,
    factCount: 2,
  });
}, 15000);

it("persists a temporary HTTP failure and succeeds on redelivery in a new process", async () => {
  await seed();
  let calls = 0;
  const url = await aiServer((res) => {
    if (++calls === 1) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message: "injected temporary outage",
          retryable: true,
        }),
      );
    } else success(res);
  });
  expect(await start(url, 1).exited).toBe(2);
  expect(await getDoc(id)).toMatchObject({ status: "retrying", attempts: 1 });
  expect(await start(url, 2).exited).toBe(0);
  expect(await getDoc(id)).toMatchObject({
    status: "succeeded",
    attempts: 2,
    lastError: null,
  });
}, 15000);
