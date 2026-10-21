import { createAdaptorServer } from "@hono/node-server";
import { app } from "server/app";

// Node HTTP server wrapping the Hono app, for supertest.
export const createTestServer = () => createAdaptorServer({ fetch: app.fetch });
