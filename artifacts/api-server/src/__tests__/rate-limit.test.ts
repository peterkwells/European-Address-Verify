import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app.js";

describe("Rate limiting on GET /api/v1/addresses/validate", () => {
  it("returns 429 with Retry-After on the 31st request within the 60-second window", async () => {
    for (let i = 1; i <= 30; i++) {
      const res = await request(app).get("/api/v1/addresses/validate");
      expect(res.status, `Request ${i} should not be rate-limited`).not.toBe(429);
    }

    const res = await request(app).get("/api/v1/addresses/validate");
    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBe("60");
    expect(res.body).toMatchObject({
      status_code: 429,
      error: "rate_limit_exceeded",
    });
  });
});
