/**
 * Austria BEV (Bundesamt für Eich- und Vermessungswesen) address ingester.
 *
 * Source: https://data.bev.gv.at/download/Adresse_Relationale_Tabellen-Stichtagsdaten_CSV.zip
 * Licence: CC BY 4.0
 * Format: ZIP containing relational CSV tables (semicolon-separated).
 * Uses Adresse_GeocodeADR.csv (denormalised) when present, else Adresse.csv.
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

const BEV_URL =
  "https://data.bev.gv.at/download/Adresse_Relationale_Tabellen-Stichtagsdaten_CSV.zip";
const BATCH_SIZE = 5000;

type BevRecord = Record<string, string | undefined>;

function pickField(record: BevRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = record[key] ?? record[key.toUpperCase()] ?? record[key.toLowerCase()];
    if (v) return v;
  }
  return undefined;
}

export async function ingestBev(): Promise<void> {
  const { path: zipPath, checksum } = await downloadFile(BEV_URL);

  if (await checkAlreadyIngested("AT", checksum)) {
    await cleanup(zipPath);
    return;
  }

  await clearCountryData("AT");

  const { Extract } = await import("unzip-stream");
  const extractDir = join(tmpdir(), "addr-AT");

  await new Promise<void>((resolve, reject) => {
    createReadStream(zipPath)
      .pipe(Extract({ path: extractDir }))
      .on("finish", resolve)
      .on("error", reject);
  });

  const allFiles = (await readdir(extractDir, { recursive: true })) as string[];

  const geocodeFile = allFiles.find((f) =>
    f.toLowerCase().includes("geocodeadr"),
  );
  const adresseFile = allFiles.find(
    (f) =>
      f.toLowerCase() === "adresse.csv" ||
      f.toLowerCase().endsWith("/adresse.csv"),
  );

  const targetFile = geocodeFile || adresseFile;
  if (!targetFile) {
    throw new Error(
      `Could not find address CSV in BEV archive. Files: ${allFiles.slice(0, 10).join(", ")}`,
    );
  }

  console.log(`  Parsing ${targetFile}...`);

  const parser = createReadStream(join(extractDir, targetFile)).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter: ";",
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
  let totalInserted = 0;

  for await (const record of parser as AsyncIterable<BevRecord>) {
    const postcode = pickField(record, "PLZ", "POSTLEITZAHL", "PLZ_ZUSTELLGEBIET");
    if (!postcode) continue;

    const city = pickField(record, "ORTSCHAFT", "GEMEINDENAME", "ORT");
    const street = pickField(record, "STRASSENNAME", "STRASSE", "ADRESSNAME");
    const house_number = pickField(record, "HAUSNUMMER", "HNR", "HAUSNR");

    batch.push({
      country_code: "AT",
      postcode,
      city: city || undefined,
      street: street || undefined,
      house_number: house_number || undefined,
      source_dataset: "BEV Adressregister",
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
  console.log(`  Inserted ${totalInserted.toLocaleString()} total records for AT.`);
  await recordIngestion("AT", BEV_URL, checksum, totalInserted);
  await cleanup(zipPath);
}
