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
 *   3. Parses the CSV/GeoJSON format and normalises field names
 *   4. Bulk-inserts into the local PostgreSQL database
 *   5. Records the ingestion in dataset_ingestions
 *
 * Datasets are large. Ensure sufficient disk space and a stable connection.
 */

import { ingestBosa } from "./ingesters/bosa-be.js";
import { ingestBev } from "./ingesters/bev-at.js";
import { ingestOpenAddresses } from "./ingesters/openaddresses.js";
import { pool } from "@workspace/db";

const INGESTERS: Record<string, () => Promise<void>> = {
  BE: ingestBosa,
  AT: ingestBev,
  DE: () => ingestOpenAddresses("DE", "https://results.openaddresses.io/addresses/global/de.zip"),
  IT: () => ingestOpenAddresses("IT", "https://results.openaddresses.io/addresses/global/it.zip"),
  ES: () => ingestOpenAddresses("ES", "https://results.openaddresses.io/addresses/global/es.zip"),
  PT: () => ingestOpenAddresses("PT", "https://results.openaddresses.io/addresses/global/pt.zip"),
  SE: () => ingestOpenAddresses("SE", "https://results.openaddresses.io/addresses/global/se.zip"),
  FI: () => ingestOpenAddresses("FI", "https://results.openaddresses.io/addresses/global/fi.zip"),
  PL: () => ingestOpenAddresses("PL", "https://results.openaddresses.io/addresses/global/pl.zip"),
  CZ: () => ingestOpenAddresses("CZ", "https://results.openaddresses.io/addresses/global/cz.zip"),
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
