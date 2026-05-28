/**
 * Belgium BOSA Best Address ingester.
 *
 * Source:  https://opendata.bosa.be/download/best/
 * Licence: CC0 1.0
 *
 * Format: one ZIP per region, each containing one semicolon-delimited CSV.
 * Relevant columns:
 *   postcode, municipality_name_nl, municipality_name_fr, municipality_name_de,
 *   house_number, streetname_nl, streetname_fr, streetname_de, region_code, status
 *
 * Street name strategy:
 *   - Flemish region (BE-VLG): streetname_nl is present; fr/de are empty.
 *   - Walloon region (BE-WAL): streetname_fr is present; nl may be empty.
 *   - German-speaking (subset of BE-WAL): streetname_de is present.
 *   - Brussels (BE-BRU): both streetname_nl and streetname_fr are populated.
 *     For Brussels, two rows are stored per address (one per language) so that
 *     validation succeeds regardless of which language the user submits.
 *
 * Only addresses with status = "current" are ingested.
 *
 * Ingestion version: v2 (added street names)
 */

import { createReadStream } from "node:fs";
import { rm } from "node:fs/promises";
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

/** Prefix bumped whenever the ingester logic changes to force re-ingest. */
const VERSION = "v2";
const BATCH_SIZE = 5000;

interface BosaRecord {
  postcode?: string;
  house_number?: string;
  municipality_name_nl?: string;
  municipality_name_fr?: string;
  municipality_name_de?: string;
  streetname_nl?: string;
  streetname_fr?: string;
  streetname_de?: string;
  region_code?: string;
  status?: string;
  [key: string]: string | undefined;
}

type AddressRow = {
  country_code: string;
  postcode: string;
  city?: string;
  street?: string;
  house_number?: string;
  source_dataset: string;
};

export async function ingestBosa(): Promise<void> {
  const { Extract } = await import("unzip-stream");

  const downloads: Array<{ path: string; checksum: string }> = [];
  for (const url of BOSA_URLS) {
    console.log(`  Downloading ${url}...`);
    downloads.push(await downloadFile(url));
  }

  const combinedChecksum =
    `${VERSION}:` + downloads.map((d) => d.checksum).join(":");

  if (await checkAlreadyIngested("BE", combinedChecksum)) {
    await Promise.all(downloads.map((d) => cleanup(d.path)));
    return;
  }

  await clearCountryData("BE");

  let totalInserted = 0;

  for (let i = 0; i < BOSA_URLS.length; i++) {
    const { path: zipPath } = downloads[i]!;
    const regionCode =
      BOSA_URLS[i]!.match(/openaddress-(\w+)\.zip/)?.[1] ?? `region${i}`;
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

      const batch: AddressRow[] = [];

      const flush = async () => {
        if (batch.length === 0) return;
        await db.insert(addressesTable).values(batch);
        totalInserted += batch.length;
        batch.length = 0;
        process.stdout.write(
          `\r  [BE ${regionCode}] Inserted ${totalInserted.toLocaleString()} records...`,
        );
      };

      for await (const record of parser as AsyncIterable<BosaRecord>) {
        const postcode = record["postcode"]?.trim();
        if (!postcode) continue;

        // Skip non-current addresses
        if (record["status"] && record["status"] !== "current") continue;

        const city =
          record["municipality_name_nl"]?.trim() ||
          record["municipality_name_fr"]?.trim() ||
          record["municipality_name_de"]?.trim() ||
          undefined;

        const houseNumber = record["house_number"]?.trim() || undefined;

        const nl = record["streetname_nl"]?.trim() || undefined;
        const fr = record["streetname_fr"]?.trim() || undefined;
        const de = record["streetname_de"]?.trim() || undefined;

        // Primary street name: NL preferred, then FR, then DE
        const primary = nl || fr || de;

        batch.push({
          country_code: "BE",
          postcode,
          city,
          street: primary,
          house_number: houseNumber,
          source_dataset: "BOSA Best Address",
        });

        // For Brussels bilingual addresses: also store the French name as a
        // separate row so validation works in either language.
        const isBrussels = record["region_code"] === "BE-BRU";
        if (isBrussels && fr && nl && fr !== nl) {
          batch.push({
            country_code: "BE",
            postcode,
            city,
            street: fr,
            house_number: houseNumber,
            source_dataset: "BOSA Best Address",
          });
        }

        if (batch.length >= BATCH_SIZE) {
          await flush();
        }
      }

      await flush();
    }

    await cleanup(zipPath);
    await rm(extractDir, { recursive: true, force: true });
    process.stdout.write("\n");
    console.log(
      `  [BE ${regionCode}] Done. Running total: ${totalInserted.toLocaleString()}`,
    );
  }

  console.log(`  BE total: ${totalInserted.toLocaleString()} records.`);
  await recordIngestion("BE", BOSA_URLS.join(", "), combinedChecksum, totalInserted);
}
