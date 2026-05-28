import { getCountry } from "../coverage-registry.js";
import { validateFR, validateNL, validateNO, validateDK } from "./open-api.js";
import { validateBulkLocal } from "./bulk-local.js";
import { validateFormatReference } from "./format-reference.js";
import type { AddressInput, ValidationResult } from "./types.js";

export { UpstreamError, DatasetNotIngestedError } from "./types.js";
export type { AddressInput, ValidationResult };

export async function validate(input: AddressInput): Promise<ValidationResult> {
  const entry = getCountry(input.country);

  if (!entry) {
    throw new Error(`UNSUPPORTED_COUNTRY:${input.country}`);
  }

  switch (entry.validation_method) {
    case "open-api":
      return validateOpenApi(input);

    case "bulk-local":
      return validateBulkLocal(input);

    case "format+reference":
      return await validateFormatReference(input, "format+reference");

    case "format-only":
      return await validateFormatReference(input, "format-only");

    case "restricted":
      return {
        valid: null,
        confidence: "unknown",
        method: "restricted",
        source: entry.data_source,
        source_url: entry.data_source_url,
        licence: entry.licence,
        normalised_address: null,
        warnings: [
          `Address data for ${entry.country_name} is commercially and legally restricted — validation is not available. See /api/v1/coverage/${entry.country_code} for details.`,
          `For authoritative ${entry.country_name} address validation, see: ${entry.data_source_url}`,
        ],
      };

    default:
      throw new Error(`Unknown validation method for ${input.country}`);
  }
}

async function validateOpenApi(input: AddressInput): Promise<ValidationResult> {
  const country = input.country.toUpperCase();
  switch (country) {
    case "FR":
      return validateFR(input);
    case "NL":
      return validateNL(input);
    case "NO":
      return validateNO(input);
    case "DK":
      return validateDK(input);
    default:
      throw new Error(`No open-api validator for country: ${country}`);
  }
}
