import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app.js";

describe("X-Service-Status: beta header", () => {
  it("is present on a successful API response", async () => {
    const res = await request(app).get("/api/v1");
    expect(res.headers["x-service-status"]).toBe("beta");
  });

  it("is present on a 400 validation error response", async () => {
    const res = await request(app).get("/api/v1/addresses/validate");
    expect(res.status).toBe(400);
    expect(res.headers["x-service-status"]).toBe("beta");
  });

  it("is present on a 404 not-found response", async () => {
    const res = await request(app).get("/api/v1/nonexistent-route");
    expect(res.headers["x-service-status"]).toBe("beta");
  });

  it("is present on the coverage endpoint", async () => {
    const res = await request(app).get("/api/v1/coverage");
    expect(res.headers["x-service-status"]).toBe("beta");
  });
});
