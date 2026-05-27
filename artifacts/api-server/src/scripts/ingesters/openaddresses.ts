/**
 * Generic OpenAddresses ingester.
 *
 * OpenAddresses compiled CSV format:
 *   LON,LAT,NUMBER,STREET,UNIT,CITY,DISTRICT,REGION,POSTCODE,ID,HASH
 *
 * Files are ZIP archives containing one or more CSV files.
 */

import { createReadStream } from "node:fs";
import { unlink, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline";
import { db } from "@workspace/db";
import { addressesTable } from "@workspace/db";
import {
  downloadFile,
  checkAlreadyIngested,
  recordIngestion,
  cleanup,
} from "./base.js";

const BATCH_SIZE = 5000;

export async function ingestOpenAddresses(
  country_code: string,
  url: string,
): Promise<void> {
  const { path: zipPath, checksum } = await downloadFile(url);

  if (await checkAlreadyIngested(country_code, checksum)) {
    await cleanup(zipPath);
    return;
  }

  const { Extract } = await import("unzip-stream");

  console.log(`  Parsing OpenAddresses data for ${country_code}...`);
  let totalInserted = 0;

  await new Promise<void>((resolve, reject) => {
    createReadStream(zipPath)
      .pipe(Extract({ path: join(tmpdir(), `addr-${country_code}`) }))
      .on("finish", resolve)
      .on("error", reject);
  });

  const extractDir = join(tmpdir(), `addr-${country_code}`);
  const files = (await readdir(extractDir, { recursive: true })).filter(
    (f) => typeof f === "string" && f.endsWith(".csv"),
  ) as string[];

  for (const file of files) {
    const filePath = join(extractDir, file);
    const rl = createInterface({
      input: createReadStream(filePath),
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
        const cols = line.split(",").map((c) => c.toLowerCase().trim());
        cols.forEach((col, i) => { headerMap[col] = i; });
        isHeader = false;
        continue;
      }

      const cols = parseCsvLine(line);
      const postcode = cols[headerMap["postcode"] ?? 8]?.trim();
      if (!postcode) continue;

      batch.push({
        country_code,
        postcode,
        city: cols[headerMap["city"] ?? 5]?.trim() || undefined,
        street: cols[headerMap["street"] ?? 3]?.trim() || undefined,
        house_number: cols[headerMap["number"] ?? 2]?.trim() || undefined,
        source_dataset: `OpenAddresses ${country_code}`,
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
  console.log(`  Inserted ${totalInserted.toLocaleString()} total records for ${country_code}.`);

  await recordIngestion(country_code, url, checksum, totalInserted);
  await cleanup(zipPath);
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
