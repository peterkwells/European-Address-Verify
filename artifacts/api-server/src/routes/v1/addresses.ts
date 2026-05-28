import { Router, type IRouter, type Request, type Response } from "express";
import { ValidateAddressQueryParams } from "@workspace/api-zod";
import {
  validate,
  UpstreamError,
  DatasetNotIngestedError,
  type ValidationResult,
} from "../../lib/validators/index.js";
import { getCountry } from "../../lib/coverage-registry.js";
import { sendError } from "./errors.js";
import { validateLimiter } from "../../lib/rate-limiter.js";

function toAsciiHeader(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, "-");
}

const router: IRouter = Router();

router.get(
  "/validate",
  validateLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = ValidateAddressQueryParams.safeParse(req.query);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({
        field: i.path.join(".") || "unknown",
        message: i.message,
      }));
      sendError(res, 400, "invalid_request", "One or more query parameters are invalid", issues);
      return;
    }

    const { country, postcode, city, street, house_number } = parsed.data;
    const countryUpper = country.toUpperCase();
    const entry = getCountry(countryUpper);

    if (!entry) {
      sendError(
        res,
        404,
        "country_not_supported",
        `Country '${countryUpper}' is not supported. See /api/v1/coverage for the list of supported countries.`,
      );
      return;
    }

    const trimmedPostcode = postcode.trim();
    if (!trimmedPostcode || trimmedPostcode.toLowerCase() === "undefined") {
      sendError(res, 400, "invalid_request", "postcode is required", [
        { field: "postcode", message: "This field is required" },
      ]);
      return;
    }
    if (!/[a-zA-Z0-9]/.test(trimmedPostcode)) {
      sendError(
        res,
        422,
        "unprocessable_entity",
        "postcode must contain at least one alphanumeric character",
        [{ field: "postcode", message: "Must contain at least one letter or digit" }],
      );
      return;
    }

    let result: ValidationResult;
    try {
      result = await validate({ country: countryUpper, postcode, city, street, house_number });
    } catch (err) {
      if (err instanceof DatasetNotIngestedError) {
        sendError(
          res,
          503,
          "dataset_not_ingested",
          err.message,
        );
        return;
      }
      if (err instanceof UpstreamError) {
        if (err.retryAfter) {
          res.setHeader("Retry-After", String(err.retryAfter));
        }
        sendError(res, err.statusCode, "upstream_error", err.message);
        return;
      }
      if (err instanceof Error && err.message.startsWith("UNSUPPORTED_COUNTRY:")) {
        sendError(
          res,
          404,
          "country_not_supported",
          `Country '${countryUpper}' is not supported.`,
        );
        return;
      }
      throw err;
    }

    const selfUrl = new URL(req.originalUrl, `${req.protocol}://${req.get("host")}`);

    res.setHeader("X-Data-Source", toAsciiHeader(entry.data_source));
    res.setHeader("X-Licence", toAsciiHeader(entry.licence));

    res.json({
      ...result,
      _links: {
        self: { href: selfUrl.pathname + selfUrl.search },
        coverage: { href: `/api/v1/coverage/${countryUpper}` },
      },
    });
  },
);

export default router;
