#!/usr/bin/env bash
set -euo pipefail

# Daemons cannot consume service bindings. Run a private local AI process for
# extraction; the HTTP API uses the separately deployed AI service through a binding.
export AI_SERVICE_URL=http://127.0.0.1:8000
cd /app/apps/ai
.venv/bin/python -m uvicorn kuki_ai.app:app --host 127.0.0.1 --port 8000 &
ai_pid=$!
worker_pid=""
cleanup() {
  kill -TERM "$ai_pid" ${worker_pid:+"$worker_pid"} 2>/dev/null || true
  wait "$ai_pid" ${worker_pid:+"$worker_pid"} 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 0' TERM INT
.venv/bin/python - <<'PY'
import time
from urllib.request import urlopen

for attempt in range(60):
    try:
        with urlopen("http://127.0.0.1:8000/health", timeout=2):
            break
    except OSError:
        time.sleep(1)
else:
    raise SystemExit("Local extraction service did not start")
PY
cd /app/apps/worker
bun src/index.ts &
worker_pid=$!
wait -n "$ai_pid" "$worker_pid"
