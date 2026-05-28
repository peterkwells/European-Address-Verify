#!/usr/bin/env node
/**
 * Address dataset ingestion script.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server run ingest [country_code...]
 *
 * Examples:
 *   pnpm --filter @workspace/api-server run ingest BE AT
 *   pnpm --filter @workspace/api-server run ingest DE IT ES PT SE FI PL CZ
 *   pnpm --filter @workspace/api-server run ingest  # ingest all bulk-local countries
 *
 * Each ingestion:
 *   1. Downloads the authoritative dataset for the country
 *   2. Verifies checksum — skips if already loaded with same checksum
 *   3. Parses the dataset format and normalises field names
 *   4. Bulk-inserts into the local PostgreSQL database
 *   5. Records the ingestion in dataset_ingestions
 *
 * Datasets are large. Ensure sufficient disk space and a stable connection.
 *
 * Data sources:
 *   IT  — ANNCSU Indirizzario Nazionale (CC0); full street + house number data.
 *         Postcodes resolved via spatial join with GeoNames IT.
 *   BE  — BOSA openaddress (CC0); street + house number data for all three regions.
 *   All others — GeoNames postal codes (CC BY 4.0); postcode + city only.
 */

import { ingestGeoNames } from "./ingesters/geonames.js";
import { ingestBosa } from "./ingesters/bosa-be.js";
import { ingestAnncsuIT } from "./ingesters/anncsu-it.js";
import { pool } from "@workspace/db";

const GEONAMES_BASE = "https://download.geonames.org/export/zip";

const INGESTERS: Record<string, () => Promise<void>> = {
  BE: () => ingestBosa(),
  AT: () => ingestGeoNames("AT", `${GEONAMES_BASE}/AT.zip`),
  DE: () => ingestGeoNames("DE", `${GEONAMES_BASE}/DE.zip`),
  IT: () => ingestAnncsuIT(),
  ES: () => ingestGeoNames("ES", `${GEONAMES_BASE}/ES.zip`),
  PT: () => ingestGeoNames("PT", `${GEONAMES_BASE}/PT.zip`),
  SE: () => ingestGeoNames("SE", `${GEONAMES_BASE}/SE.zip`),
  FI: () => ingestGeoNames("FI", `${GEONAMES_BASE}/FI.zip`),
  PL: () => ingestGeoNames("PL", `${GEONAMES_BASE}/PL.zip`),
  CZ: () => ingestGeoNames("CZ", `${GEONAMES_BASE}/CZ.zip`),
};

async function main() {
  const args = process.argv.slice(2).map((a) => a.toUpperCase());
  const toIngest = args.length > 0 ? args : Object.keys(INGESTERS);

  const unknown = toIngest.filter((c) => !INGESTERS[c]);
  if (unknown.length > 0) {
    console.error(`Unknown country codes: ${unknown.join(", ")}`);
    console.error(`Supported: ${Object.keys(INGESTERS).join(", ")}`);
    process.exit(1);
  }

  console.log(`Starting ingestion for: ${toIngest.join(", ")}`);

  for (const code of toIngest) {
    console.log(`\n[${code}] Starting ingestion...`);
    try {
      await INGESTERS[code]!();
      console.log(`[${code}] Done.`);
    } catch (err) {
      console.error(`[${code}] Failed: ${(err as Error).message}`);
    }
  }

  await pool.end();
  console.log("\nIngestion complete.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
