/**
 * GeoNames postal code ingester.
 *
 * Source: https://download.geonames.org/export/zip/<CC>.zip
 * Licence: CC BY 4.0
 * Format: ZIP containing <CC>.txt — tab-separated, no header row.
 *
 * Columns (0-indexed):
 *   0  country_code
 *   1  postal_code
 *   2  place_name
 *   3  admin1_name
 *   4  admin1_code
 *   5  admin2_name
 *   6  admin2_code
 *   7  admin3_name
 *   8  admin3_code
 *   9  latitude
 *  10  longitude
 *  11  accuracy
 *
 * Only postcode + city (place_name) are stored; no street or house number data
 * is available in this dataset. The bulk-local validator handles this gracefully.
 */

import { createReadStream } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parse } from "csv-parse";
import { db } from "@workspace/db";
import { addressesTable } from "@workspace/db";
import {
  downloadFile,
  checkAlreadyIngested,
  clearCountryData,
  recordIngestion,
  cleanup,
} from "./base.js";

const BATCH_SIZE = 5000;

export async function ingestGeoNames(
  country_code: string,
  url: string,
): Promise<void> {
  const { path: zipPath, checksum } = await downloadFile(url);

  if (await checkAlreadyIngested(country_code, checksum)) {
    await cleanup(zipPath);
    return;
  }

  await clearCountryData(country_code);

  const { Extract } = await import("unzip-stream");
  const extractDir = join(tmpdir(), `addr-${country_code}`);

  await new Promise<void>((resolve, reject) => {
    createReadStream(zipPath)
      .pipe(Extract({ path: extractDir }))
      .on("finish", resolve)
      .on("error", reject);
  });

  const txtFile = join(extractDir, `${country_code}.txt`);

  console.log(`  Parsing GeoNames data for ${country_code}...`);

  const parser = createReadStream(txtFile).pipe(
    parse({
      delimiter: "\t",
      columns: false,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
    }),
  );

  const seen = new Set<string>();
  const batch: Array<{
    country_code: string;
    postcode: string;
    city?: string;
    source_dataset: string;
  }> = [];
  let totalInserted = 0;

  for await (const row of parser as AsyncIterable<string[]>) {
    const postcode = row[1]?.trim();
    const city = row[2]?.trim();
    if (!postcode) continue;

    const key = `${postcode}|${city ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    batch.push({
      country_code,
      postcode,
      city: city || undefined,
      source_dataset: `GeoNames postal codes (${country_code})`,
    });

    if (batch.length >= BATCH_SIZE) {
      await db.insert(addressesTable).values(batch);
      totalInserted += batch.length;
      batch.length = 0;
      process.stdout.write(`\r  Inserted ${totalInserted.toLocaleString()} records...`);
    }
  }

  if (batch.length > 0) {
    await db.insert(addressesTable).values(batch);
    totalInserted += batch.length;
  }

  process.stdout.write("\n");
  console.log(`  Inserted ${totalInserted.toLocaleString()} total records for ${country_code}.`);
  await recordIngestion(country_code, url, checksum, totalInserted);
  await cleanup(zipPath);
}
