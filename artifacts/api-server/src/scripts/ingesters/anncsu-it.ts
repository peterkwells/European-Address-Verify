/**
 * Italy ANNCSU indirizzario ingester.
 *
 * Source:  https://www.anncsu.gov.it/
 * Data:    https://anncsu.open.agenziaentrate.gov.it/age-inspire/opendata/anncsu/getds.php?INDIR_{REGION}
 * Licence: CC0 (open data, EU High-Value Dataset directive — geospatial category)
 * Format:  20 regional ZIP files; each ZIP contains one semicolon-delimited CSV (UTF-8, with BOM).
 *
 * CSV columns (header row present, ";" delimiter, "," as decimal separator in coords):
 *   0  CODICE_COMUNE
 *   1  CODICE_ISTAT       – 6-digit national municipality code
 *   4  ODONIMO            – street name
 *  10  CIVICO             – house number (integer, blank for SNC streets)
 *  11  ESPONENTE          – house number suffix (A, B, …)
 *  15  COORD_X_COMUNE     – municipality centroid longitude (same for every row in same ISTAT)
 *  16  COORD_Y_COMUNE     – municipality centroid latitude
 *
 * Postcodes: not present in ANNCSU. Resolved by a two-phase spatial nearest-neighbour join
 * with GeoNames IT postal codes.
 *
 * Phase 1 (centroid collection):
 *   All 20 regional ZIPs are downloaded. Each CSV is extracted, scanned for unique
 *   (ISTAT → centroid lat/lon) entries, then discarded. ZIPs are kept on disk.
 *   Result: a single global map of all ~7 900 Italian ISTAT centroids.
 *
 * Phase 2 (postcode assignment):
 *   For every GeoNames postal code point, find the nearest ISTAT centroid in the global map
 *   (not just the current region). This prevents border municipalities from being assigned
 *   postcodes that belong to neighbouring regions. The result is a global ISTAT→postcodes map.
 *
 * Phase 3 (insertion):
 *   Each regional ZIP is re-extracted. For every address row the ISTAT code is looked up in
 *   the global map. One DB row is inserted per (postcode, street, house_number) combination,
 *   so large cities (multiple postcodes per municipality) produce multiple rows.
 */

import { createReadStream } from "node:fs";
import { unlink, readdir, mkdir, rm } from "node:fs/promises";
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

const ANNCSU_BASE =
  "https://anncsu.open.agenziaentrate.gov.it/age-inspire/opendata/anncsu/getds.php?INDIR_";
const GEONAMES_IT_URL = "https://download.geonames.org/export/zip/IT.zip";

const REGIONS = [
  "ABRU", "BASI", "CALA", "CAMP", "EMIL", "FRIU", "LAZI", "LIGU",
  "LOMB", "MARC", "MOLI", "PIEM", "PUGL", "SARD", "SICI", "TOSC",
  "TREN", "UMBR", "VALL", "VENE",
] as const;

const BATCH_SIZE = 5000;
/**
 * Squared-degree distance threshold for postcode assignment (~100 km radius).
 * Filters out GeoNames points that are unreasonably far from any ISTAT centroid in
 * the global map (would only apply to postcodes outside Italy entirely).
 */
const MAX_DIST_SQ = 1.0;

interface GeonamesPoint {
  postcode: string;
  city: string;
  lat: number;
  lon: number;
}

interface IstatCentroid {
  lat: number;
  lon: number;
}

type IstatToPostcodes = Map<string, Array<{ postcode: string; city: string }>>;

// ---------------------------------------------------------------------------
// GeoNames IT postal codes
// ---------------------------------------------------------------------------

async function loadGeonamesIT(): Promise<GeonamesPoint[]> {
  console.log("  Downloading GeoNames IT postal codes for spatial join...");
  const { path: zipPath } = await downloadFile(GEONAMES_IT_URL);
  const { Extract } = await import("unzip-stream");
  const extractDir = join(tmpdir(), "addr-anncsu-geonames-it");
  await mkdir(extractDir, { recursive: true });

  await new Promise<void>((resolve, reject) => {
    createReadStream(zipPath)
      .pipe(Extract({ path: extractDir }))
      .on("finish", resolve)
      .on("error", reject);
  });

  const txtFile = join(extractDir, "IT.txt");
  const points: GeonamesPoint[] = [];

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

  for await (const row of parser as AsyncIterable<string[]>) {
    const postcode = row[1]?.trim();
    const city = row[2]?.trim();
    const lat = parseFloat(row[9] ?? "");
    const lon = parseFloat(row[10] ?? "");
    if (!postcode || !city || isNaN(lat) || isNaN(lon)) continue;
    points.push({ postcode, city, lat, lon });
  }

  await cleanup(zipPath);
  await rm(extractDir, { recursive: true, force: true });
  console.log(`  Loaded ${points.length.toLocaleString()} GeoNames IT postal code points.`);
  return points;
}

// ---------------------------------------------------------------------------
// ZIP extraction helper
// ---------------------------------------------------------------------------

async function extractRegionCsv(zipPath: string, region: string): Promise<string> {
  const { Extract } = await import("unzip-stream");
  const extractDir = join(tmpdir(), `addr-anncsu-${region}`);
  await mkdir(extractDir, { recursive: true });

  await new Promise<void>((resolve, reject) => {
    createReadStream(zipPath)
      .pipe(Extract({ path: extractDir }))
      .on("finish", resolve)
      .on("error", reject);
  });

  const files = await readdir(extractDir);
  const csvName = files.find((f) => f.toLowerCase().endsWith(".csv"));
  if (!csvName) throw new Error(`No CSV found in ANNCSU zip for region ${region}`);
  return join(extractDir, csvName);
}

async function cleanupRegion(region: string): Promise<void> {
  try {
    await rm(join(tmpdir(), `addr-anncsu-${region}`), { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

// ---------------------------------------------------------------------------
// Phase 1 – collect ISTAT centroids from a regional CSV
// ---------------------------------------------------------------------------

async function collectIstatCentroids(
  csvPath: string,
  into: Map<string, IstatCentroid>,
): Promise<number> {
  let newEntries = 0;
  const parser = createReadStream(csvPath).pipe(
    parse({
      delimiter: ";",
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
    }),
  );

  for await (const row of parser as AsyncIterable<Record<string, string>>) {
    const istat = row["CODICE_ISTAT"]?.trim();
    if (!istat || into.has(istat)) continue;

    const lon = parseFloat((row["COORD_X_COMUNE"] ?? "").replace(",", "."));
    const lat = parseFloat((row["COORD_Y_COMUNE"] ?? "").replace(",", "."));
    if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
      into.set(istat, { lat, lon });
      newEntries++;
    }
  }
  return newEntries;
}

// ---------------------------------------------------------------------------
// Phase 2 – build global ISTAT → postcodes map
// ---------------------------------------------------------------------------

function buildGlobalIstatToPostcodes(
  allCentroids: Map<string, IstatCentroid>,
  geonamesPoints: GeonamesPoint[],
): IstatToPostcodes {
  const result: IstatToPostcodes = new Map();

  for (const gn of geonamesPoints) {
    let bestIstat = "";
    let bestDist = Infinity;

    for (const [istat, c] of allCentroids) {
      const d = (c.lat - gn.lat) ** 2 + (c.lon - gn.lon) ** 2;
      if (d < bestDist) {
        bestDist = d;
        bestIstat = istat;
      }
    }

    // MAX_DIST_SQ only rejects postcodes outside Italy entirely
    if (bestDist < MAX_DIST_SQ && bestIstat) {
      if (!result.has(bestIstat)) result.set(bestIstat, []);
      result.get(bestIstat)!.push({ postcode: gn.postcode, city: gn.city });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Phase 3 – insert address records from a regional CSV
// ---------------------------------------------------------------------------

async function insertRegionAddresses(
  csvPath: string,
  globalPostcodes: IstatToPostcodes,
  region: string,
): Promise<number> {
  const parser = createReadStream(csvPath).pipe(
    parse({
      delimiter: ";",
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
  let inserted = 0;

  const flushBatch = async () => {
    if (batch.length === 0) return;
    await db.insert(addressesTable).values(batch);
    inserted += batch.length;
    batch.length = 0;
    process.stdout.write(`\r  [IT ${region}] Inserted ${inserted.toLocaleString()} records...`);
  };

  for await (const row of parser as AsyncIterable<Record<string, string>>) {
    const istat = row["CODICE_ISTAT"]?.trim();
    if (!istat) continue;

    const postcodes = globalPostcodes.get(istat);
    if (!postcodes || postcodes.length === 0) continue;

    const odonimo = row["ODONIMO"]?.trim() || undefined;
    const civico = row["CIVICO"]?.trim();
    const esponente = row["ESPONENTE"]?.trim();
    const houseNumber = civico ? `${civico}${esponente ?? ""}`.trim() || undefined : undefined;

    for (const { postcode, city } of postcodes) {
      batch.push({
        country_code: "IT",
        postcode,
        city: city || undefined,
        street: odonimo,
        house_number: houseNumber,
        source_dataset: "ANNCSU Indirizzario Nazionale",
      });

      if (batch.length >= BATCH_SIZE) {
        await flushBatch();
      }
    }
  }

  await flushBatch();
  process.stdout.write("\n");
  return inserted;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function ingestAnncsuIT(): Promise<void> {
  // ── 0. GeoNames baseline ──────────────────────────────────────────────────
  const geonamesPoints = await loadGeonamesIT();

  // ── Download all regional ZIPs ────────────────────────────────────────────
  const zipPaths: string[] = [];
  const checksums: string[] = [];

  console.log("  Downloading ANNCSU regional files...");
  for (const region of REGIONS) {
    const url = `${ANNCSU_BASE}${region}`;
    console.log(`  Fetching region ${region}...`);
    try {
      const { path, checksum } = await downloadFile(url);
      zipPaths.push(path);
      checksums.push(checksum);
    } catch (err) {
      console.warn(`  [IT ${region}] Download failed: ${(err as Error).message}. Skipping.`);
      zipPaths.push("");
      checksums.push("");
    }
  }

  const combinedChecksum = checksums.filter(Boolean).join(":");
  if (await checkAlreadyIngested("IT", combinedChecksum)) {
    await Promise.all(zipPaths.filter(Boolean).map(cleanup));
    return;
  }

  await clearCountryData("IT");

  // ── Phase 1: collect ALL Italian ISTAT centroids from every region ────────
  console.log("\n  Phase 1: collecting ISTAT centroids from all regions...");
  const allCentroids = new Map<string, IstatCentroid>();

  for (let i = 0; i < REGIONS.length; i++) {
    const region = REGIONS[i]!;
    const zipPath = zipPaths[i];
    if (!zipPath) continue;

    try {
      const csvPath = await extractRegionCsv(zipPath, region);
      const added = await collectIstatCentroids(csvPath, allCentroids);
      await unlink(csvPath);
      await cleanupRegion(region);
      console.log(`  [IT ${region}] +${added} centroids (total ${allCentroids.size})`);
    } catch (err) {
      console.warn(`  [IT ${region}] Centroid scan failed: ${(err as Error).message}`);
    }
  }

  console.log(`\n  Phase 1 complete: ${allCentroids.size} ISTAT centroids across all regions.`);

  // ── Phase 2: build global ISTAT → postcodes map ───────────────────────────
  console.log("  Phase 2: building global postcode map...");
  const globalPostcodes = buildGlobalIstatToPostcodes(allCentroids, geonamesPoints);
  const covered = globalPostcodes.size;
  const totalAssignments = [...globalPostcodes.values()].reduce((s, a) => s + a.length, 0);
  console.log(
    `  Phase 2 complete: ${covered} ISTATs mapped, ${totalAssignments} postcode assignments.`,
  );

  // ── Phase 3: insert addresses region by region ────────────────────────────
  console.log("  Phase 3: inserting address records...");
  let totalInserted = 0;

  for (let i = 0; i < REGIONS.length; i++) {
    const region = REGIONS[i]!;
    const zipPath = zipPaths[i];
    if (!zipPath) continue;

    console.log(`\n  [IT] Processing region ${region}...`);
    try {
      const csvPath = await extractRegionCsv(zipPath, region);
      const inserted = await insertRegionAddresses(csvPath, globalPostcodes, region);
      totalInserted += inserted;
      console.log(`  [IT ${region}] Inserted ${inserted.toLocaleString()} records.`);

      await unlink(csvPath);
      await cleanupRegion(region);
    } catch (err) {
      console.error(
        `  [IT ${region}] Insertion failed: ${(err as Error).message}. Continuing.`,
      );
    } finally {
      // Always release the zip whether we succeeded or not
      await cleanup(zipPath);
    }
  }

  console.log(`\n  IT total: ${totalInserted.toLocaleString()} records from ANNCSU.`);
  await recordIngestion(
    "IT",
    `${ANNCSU_BASE}{REGION} (20 regions)`,
    combinedChecksum,
    totalInserted,
  );
}
