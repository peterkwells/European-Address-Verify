import { Router, type IRouter, type Request, type Response } from "express";
import { getAllCountries, getCountriesByTier } from "../../lib/coverage-registry.js";
import { db } from "@workspace/db";
import { datasetIngestionsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/", async (_req: Request, res: Response): Promise<void> => {
  const all = getAllCountries();
  const tier1 = getCountriesByTier(1);
  const tier2 = getCountriesByTier(2);
  const tier3 = getCountriesByTier(3);
  const tier4 = getCountriesByTier(4);

  const bulkLocalCountries = tier2.filter(
    (c) => c.validation_method === "bulk-local",
  );

  let ingestionRows: Array<{
    country_code: string;
    loaded_at: Date;
    record_count: number | null;
  }> = [];
  try {
    ingestionRows = await db
      .select({
        country_code: datasetIngestionsTable.country_code,
        loaded_at: datasetIngestionsTable.loaded_at,
        record_count: datasetIngestionsTable.record_count,
      })
      .from(datasetIngestionsTable);
  } catch {
    // DB might be unreachable — return partial response without ingestion info
  }

  const ingestedSet = new Set(ingestionRows.map((r) => r.country_code));

  const ingestion_status = {
    bulk_local_countries_total: bulkLocalCountries.length,
    bulk_local_countries_ingested: bulkLocalCountries.filter((c) =>
      ingestedSet.has(c.country_code),
    ).length,
    ingested_datasets: ingestionRows.map((r) => ({
      country_code: r.country_code,
      loaded_at: r.loaded_at,
      record_count: r.record_count,
    })),
    pending_datasets: bulkLocalCountries
      .filter((c) => !ingestedSet.has(c.country_code))
      .map((c) => ({
        country_code: c.country_code,
        country_name: c.country_name,
        ingest_command: `pnpm --filter @workspace/api-server run ingest ${c.country_code}`,
      })),
  };

  res.json({
    version: "1.0.0",
    status: "beta",
    notice: "This is a pre-release service. Rate limits apply. Do not use in production. Send any feedback to peterkwells@gmail.com.",
    description:
      "European Address Validation API. Validates addresses across European countries using openly licensed, authoritative data sources. Built in accordance with GDS API technical and data standards (https://www.gov.uk/guidance/gds-api-technical-and-data-standards).",
    documentation_url: "/api/v1/coverage",
    country_count: all.length,
    tier_1_count: tier1.length,
    tier_2_count: tier2.length,
    tier_3_count: tier3.length,
    tier_4_count: tier4.length,
    ingestion_status,
    _links: {
      self: { href: "/api/v1" },
      coverage: { href: "/api/v1/coverage" },
      validate: {
        href: "/api/v1/addresses/validate{?country,postcode,city,street,house_number}",
      },
    },
  });
});

export default router;
