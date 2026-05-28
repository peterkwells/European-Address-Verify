import { db } from "@workspace/db";
import { addressesTable, datasetIngestionsTable } from "@workspace/db";
import { eq, and, ilike } from "drizzle-orm";
import type { AddressInput, ValidationResult } from "./types.js";
import { DatasetNotIngestedError } from "./types.js";
import { getCountry } from "../coverage-registry.js";

function normaliseCity(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export async function validateBulkLocal(
  input: AddressInput,
): Promise<ValidationResult> {
  const entry = getCountry(input.country)!;
  const countryUpper = input.country.toUpperCase();

  const ingestion = await db
    .select()
    .from(datasetIngestionsTable)
    .where(eq(datasetIngestionsTable.country_code, countryUpper))
    .limit(1);

  if (ingestion.length === 0) {
    throw new DatasetNotIngestedError(entry.country_name);
  }

  const conditions = [
    eq(addressesTable.country_code, countryUpper),
    eq(addressesTable.postcode, normalisePostcode(input.postcode, countryUpper)),
  ];

  if (input.street) {
    conditions.push(ilike(addressesTable.street, `%${input.street}%`));
  }

  const rawMatches = await db
    .select()
    .from(addressesTable)
    .where(and(...conditions))
    .limit(20);

  const matches = input.city
    ? rawMatches.filter(
        (m) =>
          !m.city ||
          normaliseCity(m.city).includes(normaliseCity(input.city!)) ||
          normaliseCity(input.city!).includes(normaliseCity(m.city)),
      )
    : rawMatches.slice(0, 5);

  const warnings: string[] = [];

  if (matches.length === 0) {
    if (input.street || input.city) {
      const postcodeMatches = await db
        .select()
        .from(addressesTable)
        .where(
          and(
            eq(addressesTable.country_code, countryUpper),
            eq(addressesTable.postcode, normalisePostcode(input.postcode, countryUpper)),
          ),
        )
        .limit(1);

      if (postcodeMatches.length > 0) {
        const datasetHasStreets = postcodeMatches.some((m) => m.street !== null);
        if (!datasetHasStreets) {
          warnings.push(
            "Postcode is valid; street-level data is not available for this country in the current dataset — unable to verify street or city",
          );
          return {
            valid: true,
            confidence: "medium",
            method: "bulk-local",
            source: entry.data_source,
            source_url: entry.data_source_url,
            licence: entry.licence,
            normalised_address: {
              postcode: postcodeMatches[0]!.postcode ?? input.postcode,
              city: postcodeMatches[0]!.city ?? null,
              country_code: countryUpper,
            },
            warnings,
          };
        }
        warnings.push(
          "Postcode exists but the specific street or city was not found — the address may be partially incorrect",
        );
        return {
          valid: false,
          confidence: "medium",
          method: "bulk-local",
          source: entry.data_source,
          source_url: entry.data_source_url,
          licence: entry.licence,
          normalised_address: {
            postcode: input.postcode,
            country_code: countryUpper,
          },
          warnings,
        };
      }
    }

    return {
      valid: false,
      confidence: "high",
      method: "bulk-local",
      source: entry.data_source,
      source_url: entry.data_source_url,
      licence: entry.licence,
      normalised_address: { country_code: countryUpper, postcode: input.postcode },
      warnings: ["Address not found in the locally ingested dataset"],
    };
  }

  const best = matches[0];
  let confidence: "high" | "medium" | "low" = "low";

  if (input.house_number && input.street && input.city) {
    const exactHouseMatch = matches.find(
      (m) =>
        m.house_number?.toLowerCase() === input.house_number?.toLowerCase(),
    );
    if (exactHouseMatch) {
      confidence = "high";
    } else {
      confidence = "medium";
      warnings.push(
        `House number '${input.house_number}' was not matched exactly in the dataset`,
      );
    }
  } else if (input.street || input.city) {
    confidence = "medium";
  } else {
    confidence = "low";
    warnings.push(
      "Only postcode was provided; result is the first matching address in this postcode area",
    );
  }

  return {
    valid: true,
    confidence,
    method: "bulk-local",
    source: entry.data_source,
    source_url: entry.data_source_url,
    licence: entry.licence,
    normalised_address: {
      house_number: best.house_number ?? null,
      street: best.street ?? null,
      city: best.city ?? null,
      postcode: best.postcode ?? null,
      country_code: countryUpper,
    },
    warnings,
  };
}

function normalisePostcode(postcode: string, country: string): string {
  let p = postcode.trim().toUpperCase();
  if (country === "NL") p = p.replace(/\s+/g, " ");
  return p;
}
