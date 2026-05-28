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
import { readdir } from "node:fs/promises";
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

const BOSA_URLS = [
  "https://opendata.bosa.be/download/best/openaddress-bebru.zip",
  "https://opendata.bosa.be/download/best/openaddress-bevlg.zip",
  "https://opendata.bosa.be/download/best/openaddress-bewal.zip",
];
const BATCH_SIZE = 5000;

interface BosaRecord {
  house_number?: string;
  postcode?: string;
  municipality_name_nl?: string;
  municipality_name_fr?: string;
  municipality_name?: string;
  [key: string]: string | undefined;
}

export async function ingestBosa(): Promise<void> {
  const { Extract } = await import("unzip-stream");

  const downloads = await Promise.all(BOSA_URLS.map((url) => downloadFile(url)));
  const combinedChecksum = downloads.map((d) => d.checksum).join(":");

  if (await checkAlreadyIngested("BE", combinedChecksum)) {
    await Promise.all(downloads.map((d) => cleanup(d.path)));
    return;
  }

  await clearCountryData("BE");

  let totalInserted = 0;

  for (let i = 0; i < BOSA_URLS.length; i++) {
    const { path: zipPath } = downloads[i]!;
    const regionCode = BOSA_URLS[i]!.match(/openaddress-(\w+)\.zip/)?.[1] ?? `region${i}`;
    const extractDir = join(tmpdir(), `addr-BE-${regionCode}`);

    await new Promise<void>((resolve, reject) => {
      createReadStream(zipPath)
        .pipe(Extract({ path: extractDir }))
        .on("finish", resolve)
        .on("error", reject);
    });

    const files = (await readdir(extractDir, { recursive: true })).filter(
      (f) => typeof f === "string" && f.endsWith(".csv"),
    ) as string[];

    for (const file of files) {
      const parser = createReadStream(join(extractDir, file)).pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
          bom: true,
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

      for await (const record of parser as AsyncIterable<BosaRecord>) {
        const postcode = record["postcode"];
        if (!postcode) continue;

        const municipality =
          record["municipality_name_nl"] ||
          record["municipality_name_fr"] ||
          record["municipality_name"];

        batch.push({
          country_code: "BE",
          postcode,
          city: municipality || undefined,
          house_number: record["house_number"] || undefined,
          source_dataset: "BOSA opendata.bosa.be",
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
    }

    await cleanup(zipPath);
  }

  process.stdout.write("\n");
  console.log(`  Inserted ${totalInserted.toLocaleString()} total records for BE.`);
  await recordIngestion("BE", BOSA_URLS.join(", "), combinedChecksum, totalInserted);
}
