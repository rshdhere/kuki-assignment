# AI service client

`@kuki/ai`: HTTP client for the Python AI service in [`apps/ai`](../../../apps/ai/README.md).

| Function        | Endpoint               | Used by                       |
| --------------- | ---------------------- | ----------------------------- |
| `extract`       | `POST /extract`        | the worker, per document      |
| `ask`           | `POST /ask`            | `POST /answers` on the server |
| `financialYear` | `POST /financial-year` | `GET /financial-year`         |
| `evaluations`   | `GET /evaluations`     | `GET /evaluations`            |

Failures throw `AiServiceError` with `retryable`: true when the service is unreachable, timed out, rate limited or returned a 5xx; false for input it can never process (a corrupt or unsupported file, a request the model rejects). The worker fails a document straight away on non-retryable errors instead of spending its SQS retries.

## Environment

| Variable         | Description                                               |
| ---------------- | --------------------------------------------------------- |
| `AI_SERVICE_URL` | Base URL of the service (default `http://localhost:8000`) |
| `AI_TIMEOUT_MS`  | Per-request timeout (default 240000)                      |
