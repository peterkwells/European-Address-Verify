# European Address Validator

A GDS-standards-compliant REST API for validating European addresses using openly licensed, authoritative data sources. Demonstrates that address validation is free, open, and legally straightforward across most of Europe — and that AI coding tools (Replit) can build a working validator rapidly at zero cost.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port varies, check workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run ingest [BE AT DE IT ES PT SE FI PL CZ]` — ingest bulk address datasets for Tier 2 countries
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, versioned under `/api/v1/`
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Address format validation: `postcode-validator`
- Dataset ingestion: streaming download + `unzip-stream` + batch PostgreSQL inserts
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `artifacts/api-server/src/lib/coverage-registry.ts` — country metadata (tier, source, licence, legal risk)
- `artifacts/api-server/src/lib/validators/` — per-country validation logic
- `artifacts/api-server/src/routes/v1/` — GDS-compliant route handlers
- `artifacts/api-server/src/scripts/ingest.ts` — data ingestion entry point
- `artifacts/api-server/src/scripts/ingesters/` — per-source ingestion modules
- `lib/db/src/schema/addresses.ts` — DB schema for bulk-local address data

## API Endpoints

All endpoints versioned under `/api/v1/`. GDS error format throughout.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1` | API metadata (version, coverage counts) |
| GET | `/api/v1/addresses/validate` | Validate an address (`country`, `postcode`, `city`, `street`, `house_number`) |
| GET | `/api/v1/coverage` | List all 20 supported countries |
| GET | `/api/v1/coverage/{country_code}` | Full country detail (source, licence, cost, legal risk, ingestion status) |
| GET | `/api/healthz` | Health check |

## Validation Tiers

- **Tier 1 — Live authoritative API** (FR, NL, NO, DK): real-time lookup, `confidence: "high"`
- **Tier 2 — Bulk-local** (BE, AT, DE, IT, ES, PT, SE, FI, PL, CZ): PostgreSQL query against ingested national dataset. Returns 503 until dataset is ingested. Run `pnpm ingest` first.
- **Tier 2 — Format+reference** (IE, CH, LU): postcode format regex + city reference
- **Tier 2 — Format-only** (HU, RO): postcode format regex only
- **Tier 3 — Restricted** (GB): `valid: null`, full explanation of Royal Mail PAF / OS AddressBase licensing

## Data Ingestion (Tier 2 Bulk Countries)

Run before serving those countries:
```
pnpm --filter @workspace/api-server run ingest BE AT DE
```

Sources:
- BE: BOSA opendata.bosa.be (CC0)
- AT: BEV Adressregister (CC BY 4.0)
- DE/IT/ES/PT/SE/FI/PL/CZ: OpenAddresses compiled files (ODbL)

Ingestion is idempotent (skips if checksum matches).

## Architecture decisions

- **GDS API standards**: snake_case fields, `_links` HAL-style self-links, `{ status_code, error, message, errors[] }` error envelope, no trailing slashes, versioned URLs
- **Tier 1 validators call upstream APIs at request time** — no caching — to always return current authoritative data
- **Bulk-local uses Drizzle ORM** with indexes on `(country_code, postcode)` and `(country_code, postcode, city)` for fast lookups
- **GB returns `valid: null`** (not false) to distinguish "not found" from "cannot determine"
- **Header values sanitised to ASCII** before setting `X-Data-Source` and `X-Licence` response headers (some source names contain em dashes)

## Product

A developer tool that makes it easy to validate European addresses during data entry or data cleanse. Shows that open-licensed authoritative data is freely available for most European countries, while the UK's Royal Mail PAF / OS AddressBase system is commercially licensed and legally complex. Built rapidly with Replit and AI coding tools at zero cost.

## User preferences

_Populate as you build._

## Gotchas

- Bulk-local countries return 503 until the dataset is ingested. Run `pnpm --filter @workspace/api-server run ingest` first.
- OpenAddresses download URLs may change — check https://results.openaddresses.io for current country file URLs if ingestion fails.
- The BEV (Austria) archive uses semicolon-separated CSV with varied column name casing across releases.
- `postcode-validator` uses ISO 3166-1 alpha-2 codes and covers most European countries. Some edge-case postcodes may not be in its database.
- `X-Data-Source` and `X-Licence` response headers are sanitised to ASCII to avoid Node HTTP errors with em dashes and other non-ASCII characters in source names.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
