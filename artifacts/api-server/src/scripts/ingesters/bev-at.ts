/**
 * Austria BEV (Bundesamt für Eich- und Vermessungswesen) address ingester.
 *
 * Source: https://data.bev.gv.at/download/Adresse_Relationale_Tabellen-Stichtagsdaten_CSV.zip
 * Licence: CC BY 4.0
 * Format: ZIP containing relational CSV tables. The main address table
 * (Adresse.csv) links via ADRCD to Ortsname.csv (place names) and
 * GKZ (municipality key) to Strasse.csv (street names).
 *
 * Simplified approach: load the flat Adresse_GeocodeADR.csv if available,
 * which contains denormalised fields. Fall back to relational join.
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

const BEV_URL =
  "https://data.bev.gv.at/download/Adresse_Relationale_Tabellen-Stichtagsdaten_CSV.zip";
const BATCH_SIZE = 5000;

export async function ingestBev(): Promise<void> {
  const { path: zipPath, checksum } = await downloadFile(BEV_URL);

  if (await checkAlreadyIngested("AT", checksum)) {
    await cleanup(zipPath);
    return;
  }

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
    (f) => f.toLowerCase() === "adresse.csv" || f.toLowerCase().endsWith("/adresse.csv"),
  );

  const targetFile = geocodeFile || adresseFile;
  if (!targetFile) {
    throw new Error(`Could not find address CSV in BEV archive. Files: ${allFiles.slice(0, 10).join(", ")}`);
  }

  console.log(`  Parsing ${targetFile}...`);

  const rl = createInterface({
    input: createReadStream(join(extractDir, targetFile)),
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
  let totalInserted = 0;

  for await (const line of rl) {
    if (isHeader) {
      const cols = line.split(";").map((c) => c.toLowerCase().replace(/"/g, "").trim());
      cols.forEach((col, i) => { headerMap[col] = i; });
      isHeader = false;
      continue;
    }

    const cols = line.split(";").map((c) => c.replace(/"/g, "").trim());

    const postcode =
      cols[headerMap["plz"]] ||
      cols[headerMap["postleitzahl"]] ||
      cols[headerMap["plz_zustellgebiet"]];

    if (!postcode) continue;

    const city =
      cols[headerMap["ortschaft"]] ||
      cols[headerMap["gemeindename"]] ||
      cols[headerMap["ort"]];

    const street =
      cols[headerMap["strassenname"]] ||
      cols[headerMap["strasse"]] ||
      cols[headerMap["adressname"]];

    const house_number =
      cols[headerMap["hausnummer"]] ||
      cols[headerMap["hnr"]] ||
      cols[headerMap["hausnr"]];

    batch.push({
      country_code: "AT",
      postcode,
      city: city || undefined,
      street: street || undefined,
      house_number: house_number || undefined,
      source_dataset: "BEV Adressregister",
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

  process.stdout.write("\n");
  console.log(`  Inserted ${totalInserted.toLocaleString()} total records for AT.`);
  await recordIngestion("AT", BEV_URL, checksum, totalInserted);
  await cleanup(zipPath);
}
