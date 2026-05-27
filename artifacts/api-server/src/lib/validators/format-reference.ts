import { postcodeValidator, postcodeValidatorExistsForCountry } from "postcode-validator";
import type { AddressInput, ValidationResult } from "./types.js";
import { getCountry } from "../coverage-registry.js";

export function validateFormatReference(
  input: AddressInput,
  method: "format+reference" | "format-only",
): ValidationResult {
  const entry = getCountry(input.country)!;
  const countryUpper = input.country.toUpperCase();

  const warnings: string[] = [];
  let valid: boolean | null = null;

  if (!postcodeValidatorExistsForCountry(countryUpper)) {
    warnings.push(
      `No postcode format definition available for ${countryUpper}; format could not be verified`,
    );
    valid = null;
  } else {
    const formatValid = postcodeValidator(input.postcode, countryUpper);
    if (!formatValid) {
      valid = false;
      warnings.push(
        `Postcode '${input.postcode}' does not match the expected format for ${entry.country_name}`,
      );
    } else {
      valid = true;
    }
  }

  if (method === "format-only") {
    warnings.push(
      "Validation is based on postcode format only. No authoritative address database is available for this country under an open licence.",
    );
  } else {
    warnings.push(
      "Validation is based on postcode format and reference data. This does not guarantee the address exists — it only confirms the format is valid.",
    );
  }

  return {
    valid,
    confidence: valid === true ? "low" : valid === false ? "high" : "unknown",
    method,
    source: entry.data_source,
    source_url: entry.data_source_url,
    licence: entry.licence,
    normalised_address: valid
      ? {
          postcode: input.postcode.toUpperCase().trim(),
          city: input.city ?? null,
          street: input.street ?? null,
          house_number: input.house_number ?? null,
          country_code: countryUpper,
        }
      : null,
    warnings,
  };
}
