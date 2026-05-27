import { Router, type IRouter, type Request, type Response } from "express";
import { getAllCountries, getCountriesByTier } from "../../lib/coverage-registry.js";

const router: IRouter = Router();

router.get("/", (_req: Request, res: Response) => {
  const all = getAllCountries();
  const tier1 = getCountriesByTier(1);
  const tier2 = getCountriesByTier(2);
  const tier3 = getCountriesByTier(3);

  res.json({
    version: "1.0.0",
    description:
      "European Address Validation API. Validates addresses across European countries using openly licensed, authoritative data sources. Built in accordance with GDS API technical and data standards.",
    documentation_url: "/api/v1/coverage",
    country_count: all.length,
    tier_1_count: tier1.length,
    tier_2_count: tier2.length,
    tier_3_count: tier3.length,
    _links: {
      self: { href: "/api/v1" },
      coverage: { href: "/api/v1/coverage" },
      validate: { href: "/api/v1/addresses/validate{?country,postcode,city,street,house_number}" },
    },
  });
});

export default router;
