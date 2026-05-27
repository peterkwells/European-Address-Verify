/**
 * Generic OpenAddresses ingester.
 *
 * OpenAddresses compiled CSV format:
 *   LON,LAT,NUMBER,STREET,UNIT,CITY,DISTRICT,REGION,POSTCODE,ID,HASH
 *
 * Files are ZIP archives containing one or more CSV files.
 * Uses csv-parse for standards-compliant CSV parsing (handles quoted fields,
 * escaped quotes, embedded commas, BOM, etc.).
 */

import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
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

interface OARecord {
  NUMBER?: string;
  STREET?: string;
  CITY?: string;
  POSTCODE?: string;
  [key: string]: string | undefined;
}

export async function ingestOpenAddresses(
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

  console.log(`  Parsing OpenAddresses data for ${country_code}...`);

  const files = (await readdir(extractDir, { recursive: true })).filter(
    (f) => typeof f === "string" && f.endsWith(".csv"),
  ) as string[];

  let totalInserted = 0;

  for (const file of files) {
    const filePath = join(extractDir, file);
    const parser = createReadStream(filePath).pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        bom: true,
        on_record: (record: Record<string, string>) => {
          const normalised: OARecord = {};
          for (const [k, v] of Object.entries(record)) {
            normalised[k.toUpperCase()] = v;
          }
          return normalised;
        },
      }),
    );

    const batch: Array<{
      country_code: string;
      postcode: string;
      city?: string;
      street?: string;
      house_number?: string;
      source_dataset: string;
    }> = [];

    for await (const record of parser as AsyncIterable<OARecord>) {
      const postcode = record["POSTCODE"]?.trim();
      if (!postcode) continue;

      batch.push({
        country_code,
        postcode,
        city: record["CITY"]?.trim() || undefined,
        street: record["STREET"]?.trim() || undefined,
        house_number: record["NUMBER"]?.trim() || undefined,
        source_dataset: `OpenAddresses ${country_code}`,
      });

      if (batch.length >= BATCH_SIZE) {
        await db.insert(addressesTable).values(batch);
        totalInserted += batch.length;
        batch.length = 0;
        process.stdout.write(
          `\r  Inserted ${totalInserted.toLocaleString()} records...`,
        );
      }
    }

    if (batch.length > 0) {
      await db.insert(addressesTable).values(batch);
      totalInserted += batch.length;
    }
  }

  process.stdout.write("\n");
  console.log(
    `  Inserted ${totalInserted.toLocaleString()} total records for ${country_code}.`,
  );

  await recordIngestion(country_code, url, checksum, totalInserted);
  await cleanup(zipPath);
}
