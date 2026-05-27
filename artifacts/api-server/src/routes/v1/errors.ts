import type { Response } from "express";

interface FieldError {
  field: string;
  message: string;
}

export function sendError(
  res: Response,
  statusCode: number,
  error: string,
  message: string,
  errors: FieldError[] = [],
): void {
  res.status(statusCode).json({
    status_code: statusCode,
    error,
    message,
    ...(errors.length > 0 ? { errors } : {}),
  });
}
