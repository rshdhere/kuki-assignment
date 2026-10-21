import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "server/app";

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("GET /openapi.yaml", () => {
  it("serves the OpenAPI spec", async () => {
    const res = await request(app).get("/openapi.yaml");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/yaml");
    expect(res.text).toContain("openapi: 3.1.0");
  });
});
