import { createHash } from "node:crypto";
import { createWriteStream, createReadStream } from "node:fs";
import { unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pipeline } from "node:stream/promises";
import { createGunzip, createUnzip } from "node:zlib";
import { db } from "@workspace/db";
import { datasetIngestionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface ParsedAddress {
  postcode: string;
  city?: string;
  street?: string;
  house_number?: string;
}

export interface IngestionOptions {
  country_code: string;
  source_url: string;
  source_dataset: string;
}

export async function checkAlreadyIngested(
  country_code: string,
  checksum: string,
): Promise<boolean> {
  const rows = await db
    .select()
    .from(datasetIngestionsTable)
    .where(eq(datasetIngestionsTable.country_code, country_code))
    .limit(1);

  if (rows.length > 0 && rows[0].checksum === checksum) {
    console.log(`  [${country_code}] Already ingested with same checksum — skipping.`);
    return true;
  }
  return false;
}

export async function downloadFile(url: string): Promise<{ path: string; checksum: string }> {
  const tmpDir = join(tmpdir(), "addr-ingest");
  await mkdir(tmpDir, { recursive: true });
  const dest = join(tmpDir, `${Date.now()}.download`);

  console.log(`  Downloading ${url}...`);

  const resp = await fetch(url);
  if (!resp.ok || !resp.body) {
    throw new Error(`Failed to download ${url}: HTTP ${resp.status}`);
  }

  const hash = createHash("sha256");
  const writer = createWriteStream(dest);
  let downloaded = 0;

  for await (const chunk of resp.body as unknown as AsyncIterable<Uint8Array>) {
    hash.update(chunk);
    writer.write(chunk);
    downloaded += chunk.length;
    if (downloaded % (10 * 1024 * 1024) === 0) {
      console.log(`  Downloaded ${Math.round(downloaded / 1024 / 1024)}MB...`);
    }
  }

  await new Promise<void>((resolve, reject) => {
    writer.end((err?: Error | null) => (err ? reject(err) : resolve()));
  });

  const checksum = hash.digest("hex");
  console.log(`  Download complete. Checksum: ${checksum.substring(0, 12)}...`);
  return { path: dest, checksum };
}

export async function recordIngestion(
  country_code: string,
  source_url: string,
  checksum: string,
  record_count: number,
): Promise<void> {
  const existing = await db
    .select()
    .from(datasetIngestionsTable)
    .where(eq(datasetIngestionsTable.country_code, country_code))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(datasetIngestionsTable)
      .set({ source_url, checksum, record_count, loaded_at: new Date() })
      .where(eq(datasetIngestionsTable.country_code, country_code));
  } else {
    await db.insert(datasetIngestionsTable).values({
      country_code,
      source_url,
      checksum,
      record_count,
      loaded_at: new Date(),
    });
  }
}

export async function cleanup(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // best effort
  }
}

export function makeReadStream(filePath: string, compressed: "gz" | "zip" | "none") {
  const base = createReadStream(filePath);
  if (compressed === "gz") return base.pipe(createGunzip());
  if (compressed === "zip") return base.pipe(createUnzip());
  return base;
}
