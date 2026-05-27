/**
 * Belgium BOSA address ingester.
 *
 * Source: https://opendata.bosa.be/download/best/openaddress-bevaddress.zip
 * Licence: CC0 1.0
 * Format: ZIP containing CSV files with fields:
 *   street_id, house_number, box_number, postcode, municipality_name,
 *   municipality_name_nl, municipality_name_fr, municipality_name_de,
 *   position_x, position_y, lat, lon, status
 */

import { createReadStream } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline";
import { readdir } from "node:fs/promises";
import { db } from "@workspace/db";
import { addressesTable } from "@workspace/db";
import {
  downloadFile,
  checkAlreadyIngested,
  recordIngestion,
  cleanup,
} from "./base.js";

const BOSA_URL = "https://opendata.bosa.be/download/best/openaddress-bevaddress.zip";
const BATCH_SIZE = 5000;

export async function ingestBosa(): Promise<void> {
  const { path: zipPath, checksum } = await downloadFile(BOSA_URL);

  if (await checkAlreadyIngested("BE", checksum)) {
    await cleanup(zipPath);
    return;
  }

  const { Extract } = await import("unzip-stream");
  const extractDir = join(tmpdir(), "addr-BE");

  await new Promise<void>((resolve, reject) => {
    createReadStream(zipPath)
      .pipe(Extract({ path: extractDir }))
      .on("finish", resolve)
      .on("error", reject);
  });

  const files = (await readdir(extractDir, { recursive: true })).filter(
    (f) => typeof f === "string" && f.endsWith(".csv"),
  ) as string[];

  let totalInserted = 0;

  for (const file of files) {
    const rl = createInterface({
      input: createReadStream(join(extractDir, file)),
      crlfDelay: Infinity,
    });

    let isHeader = true;
    let headerMap: Record<string, number> = {};
    const batch: Array<{
      country_code: string;
      postcode: string;
      city?: string;
      street?: string;
      house_number?: string;
      source_dataset: string;
    }> = [];

    for await (const line of rl) {
      if (isHeader) {
        const cols = line.split(",").map((c) => c.toLowerCase().replace(/"/g, "").trim());
        cols.forEach((col, i) => { headerMap[col] = i; });
        isHeader = false;
        continue;
      }

      const cols = line.split(",").map((c) => c.replace(/"/g, "").trim());
      const postcode = cols[headerMap["postcode"] ?? 3];
      if (!postcode) continue;

      const municipality =
        cols[headerMap["municipality_name_nl"]] ||
        cols[headerMap["municipality_name_fr"]] ||
        cols[headerMap["municipality_name"]];

      batch.push({
        country_code: "BE",
        postcode,
        city: municipality || undefined,
        house_number: cols[headerMap["house_number"]] || undefined,
        source_dataset: "BOSA opendata.bosa.be",
      });

      if (batch.length >= BATCH_SIZE) {
        await db.insert(addressesTable).values(batch).onConflictDoNothing();
        totalInserted += batch.length;
        batch.length = 0;
        process.stdout.write(`\r  Inserted ${totalInserted.toLocaleString()} records...`);
      }
    }

    if (batch.length > 0) {
      await db.insert(addressesTable).values(batch).onConflictDoNothing();
      totalInserted += batch.length;
    }
  }

  process.stdout.write("\n");
  console.log(`  Inserted ${totalInserted.toLocaleString()} total records for BE.`);
  await recordIngestion("BE", BOSA_URL, checksum, totalInserted);
  await cleanup(zipPath);
}
