import { postcodeValidator, postcodeValidatorExistsForCountry } from "postcode-validator";
import type { AddressInput, ValidationResult } from "./types.js";
import { getCountry } from "../coverage-registry.js";
import { IE_ROUTING_AREAS, LU_POSTCODE_CITY } from "./reference-data.js";

/**
 * Look up the canonical city name(s) for a Swiss postcode using the
 * openplzapi.org API (open data, Swiss Post, CC BY 4.0).
 * Returns null when the API is unreachable or the postcode is unknown.
 */
async function lookupSwissCity(postcode: string): Promise<string[] | null> {
  try {
    const url = `https://openplzapi.org/ch/Localities?postalCode=${encodeURIComponent(postcode)}&page=1&pageSize=5`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!resp.ok) return null;
    const data = (await resp.json()) as Array<{ name?: string }>;
    const cities = data.map((d) => d.name ?? "").filter(Boolean);
    return cities.length > 0 ? cities : null;
  } catch {
    return null;
  }
}

/**
 * Validates an Irish Eircode's routing key against the official routing key list.
 * Returns the associated county/area string, or null if the key is not recognised.
 */
function validateIrishRoutingKey(postcode: string): string | null {
  const normalised = postcode.trim().toUpperCase().replace(/\s+/g, "");
  if (normalised.length < 3) return null;
  const routingKey = normalised.slice(0, 3);
  return IE_ROUTING_AREAS[routingKey] ?? null;
}

/**
 * Looks up a Luxembourg postcode in the embedded reference table.
 * Returns the canonical municipality name or null if not found.
 */
function lookupLuxembourgCity(postcode: string): string | null {
  const normalised = postcode.trim().replace(/^L-/i, "");
  return LU_POSTCODE_CITY[normalised] ?? null;
}

function normaliseCity(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function cityMatches(provided: string, canonical: string | string[]): boolean {
  const needle = normaliseCity(provided);
  const haystack = Array.isArray(canonical) ? canonical : [canonical];
  return haystack.some((c) => {
    const c2 = normaliseCity(c);
    return c2 === needle || c2.includes(needle) || needle.includes(c2);
  });
}

export async function validateFormatReference(
  input: AddressInput,
  method: "format+reference" | "format-only",
): Promise<ValidationResult> {
  const entry = getCountry(input.country)!;
  const countryUpper = input.country.toUpperCase();
  const warnings: string[] = [];

  // ── Step 1: postcode format validation ─────────────────────────────────────
  let formatValid: boolean | null = null;
  if (!postcodeValidatorExistsForCountry(countryUpper)) {
    warnings.push(
      `No postcode format definition available for ${countryUpper}; format could not be verified`,
    );
  } else {
    formatValid = postcodeValidator(input.postcode, countryUpper);
    if (!formatValid) {
      warnings.push(
        `Postcode '${input.postcode}' does not match the expected format for ${entry.country_name}`,
      );
      return {
        valid: false,
        confidence: "high",
        method,
        source: entry.data_source,
        source_url: entry.data_source_url,
        licence: entry.licence,
        normalised_address: null,
        warnings,
      };
    }
  }

  // ── Step 2: reference lookup (format+reference countries only) ──────────────
  if (method === "format-only") {
    warnings.push(
      "Validation is based on postcode format only. No authoritative address database is available for this country under an open licence.",
    );
    return {
      valid: formatValid ?? null,
      confidence: formatValid === true ? "low" : "unknown",
      method,
      source: entry.data_source,
      source_url: entry.data_source_url,
      licence: entry.licence,
      normalised_address:
        formatValid === true
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

  // ── format+reference: country-specific city consistency check ───────────────
  let referenceCity: string | string[] | null = null;
  let referenceFound = false;

  if (countryUpper === "CH") {
    const cities = await lookupSwissCity(input.postcode);
    if (cities) {
      referenceFound = true;
      referenceCity = cities;
    } else {
      warnings.push(
        "Swiss postal code reference lookup was unavailable; result is based on format only",
      );
    }
  } else if (countryUpper === "IE") {
    const area = validateIrishRoutingKey(input.postcode);
    if (area) {
      referenceFound = true;
      referenceCity = area;
    } else {
      // Valid format but routing key not in known list — may be new or special
      warnings.push(
        `Eircode routing key '${input.postcode.slice(0, 3).toUpperCase()}' is not in the known routing key list; postcode format is valid but location could not be verified`,
      );
    }
  } else if (countryUpper === "LU") {
    const city = lookupLuxembourgCity(input.postcode);
    if (city) {
      referenceFound = true;
      referenceCity = city;
    } else {
      warnings.push(
        "Postcode is correctly formatted but could not be verified against the reference dataset",
      );
    }
  }

  // ── Step 3: city consistency check ─────────────────────────────────────────
  let valid: boolean | null = formatValid ?? null;
  let confidence: "high" | "medium" | "low" | "unknown" =
    referenceFound ? "medium" : "low";

  if (referenceFound && referenceCity && input.city) {
    const matches = cityMatches(input.city, referenceCity);
    if (!matches) {
      const canonical = Array.isArray(referenceCity)
        ? referenceCity.join(" / ")
        : referenceCity;
      warnings.push(
        `Provided city '${input.city}' does not match the reference location for this postcode (expected: ${canonical})`,
      );
      valid = false;
      confidence = "medium";
    } else {
      valid = true;
      confidence = "medium";
    }
  }

  const normalisedCity: string | null =
    referenceCity
      ? Array.isArray(referenceCity)
        ? referenceCity[0] ?? null
        : referenceCity
      : (input.city ?? null);

  warnings.push(
    "Validation is based on postcode format and reference data. This does not confirm the full address exists.",
  );

  return {
    valid,
    confidence,
    method,
    source: entry.data_source,
    source_url: entry.data_source_url,
    licence: entry.licence,
    normalised_address:
      valid !== false
        ? {
            postcode: input.postcode.toUpperCase().trim(),
            city: normalisedCity,
            street: input.street ?? null,
            house_number: input.house_number ?? null,
            country_code: countryUpper,
          }
        : null,
    warnings,
  };
}
