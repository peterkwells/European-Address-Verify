import { Router, type IRouter, type Request, type Response } from "express";
import {
  getAllCountries,
  getCountry,
  type CountryEntry,
} from "../../lib/coverage-registry.js";
import { db } from "@workspace/db";
import { datasetIngestionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendError } from "./errors.js";

const router: IRouter = Router();

router.get("/", async (_req: Request, res: Response): Promise<void> => {
  const countries = getAllCountries();

  const list = countries.map((c) => ({
    country_code: c.country_code,
    country_name: c.country_name,
    tier: c.tier,
    validation_method: c.validation_method,
    data_source: c.data_source,
    licence: c.licence,
    cost: c.cost,
    legal_risk: c.legal_risk,
    _links: {
      self: { href: `/api/v1/coverage/${c.country_code}` },
    },
  }));

  res.json({
    countries: list,
    count: list.length,
    _links: {
      self: { href: "/api/v1/coverage" },
      validate: { href: "/api/v1/addresses/validate" },
    },
  });
});

router.get(
  "/:country_code",
  async (req: Request, res: Response): Promise<void> => {
    const code = (req.params.country_code as string)?.toUpperCase();

    if (!code || !/^[A-Z]{2}$/.test(code)) {
      sendError(
        res,
        400,
        "invalid_request",
        "country_code must be a 2-letter ISO 3166-1 alpha-2 code",
        [{ field: "country_code", message: "Must be exactly 2 uppercase letters" }],
      );
      return;
    }

    const entry: CountryEntry | undefined = getCountry(code);
    if (!entry) {
      sendError(
        res,
        404,
        "not_found",
        `Country '${code}' is not in the coverage list.`,
      );
      return;
    }

    let ingestion_status: string | null = null;
    let ingestion_last_loaded_at: Date | null = null;

    if (entry.validation_method === "open-api") {
      ingestion_status = "live";
    } else if (
      entry.validation_method === "format+reference" ||
      entry.validation_method === "format-only" ||
      entry.validation_method === "restricted"
    ) {
      ingestion_status = "not_applicable";
    } else {
      try {
        const rows = await db
          .select()
          .from(datasetIngestionsTable)
          .where(eq(datasetIngestionsTable.country_code, code))
          .limit(1);

        if (rows.length > 0) {
          ingestion_status = "ingested";
          ingestion_last_loaded_at = rows[0].loaded_at;
        } else {
          ingestion_status = "not_ingested";
        }
      } catch {
        ingestion_status = "not_ingested";
      }
    }

    res.json({
      country_code: entry.country_code,
      country_name: entry.country_name,
      tier: entry.tier,
      validation_method: entry.validation_method,
      validation_method_description: entry.validation_method_description,
      data_source: entry.data_source,
      data_source_url: entry.data_source_url,
      licence: entry.licence,
      licence_url: entry.licence_url,
      cost: entry.cost,
      cost_description: entry.cost_description,
      legal_risk: entry.legal_risk,
      legal_risk_notes: entry.legal_risk_notes,
      ingestion_status,
      ingestion_last_loaded_at,
      _links: {
        self: { href: `/api/v1/coverage/${code}` },
        coverage_list: { href: "/api/v1/coverage" },
        ...(entry.validation_method !== "restricted"
          ? {
              validate: {
                href: `/api/v1/addresses/validate?country=${code}`,
              },
            }
          : {}),
      },
    });
  },
);

export default router;
