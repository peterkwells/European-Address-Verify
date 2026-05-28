import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import { sendError } from "../routes/v1/errors.js";

function rateLimitHandler(_req: Request, res: Response): void {
  res.setHeader("Retry-After", "60");
  sendError(res, 429, "rate_limit_exceeded", "Too many requests. Please slow down and try again later.");
}

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export const validateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: rateLimitHandler,
});
