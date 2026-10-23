// Exercise data-backed routes: /health alone cannot detect a missing migration.
const origin = process.argv[2];
if (!origin || !["https:", "http:"].includes(new URL(origin).protocol)) {
  throw new Error(
    "Usage: node scripts/verify-deployment.mjs <deployment-origin>",
  );
}

async function get(path) {
  const res = await fetch(new URL(path, origin), {
    signal: AbortSignal.timeout(30_000),
    headers: { "Cache-Control": "no-cache" },
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

async function verify() {
  const health = await get("/api/health");
  if (health.status !== "ok") throw new Error("API health is not ok");
  const docs = await get("/api/documents?limit=1");
  if (!Array.isArray(docs.documents))
    throw new Error("Invalid documents response");
  if (docs.documents.length) {
    const id = docs.documents[0].id;
    const detail = await get(`/api/documents/${encodeURIComponent(id)}`);
    if (detail.document?.id !== id || !Array.isArray(detail.facts)) {
      throw new Error("Invalid document detail response");
    }
  }
  const evals = await get("/api/evaluations");
  if (!evals.runs || !evals.comparison)
    throw new Error("Evaluation results unavailable");
  console.log(
    "Deployment verified: API, documents, extracted facts and evaluation service",
  );
}

for (let attempt = 1; ; attempt++) {
  try {
    await verify();
    break;
  } catch (err) {
    if (attempt === 3) throw err;
    console.error(`Deployment check ${attempt}/3 failed: ${err.message}`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}
