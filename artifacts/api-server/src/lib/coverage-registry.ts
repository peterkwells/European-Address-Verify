export type ValidationMethod =
  | "open-api"
  | "bulk-local"
  | "format+reference"
  | "format-only"
  | "restricted";

export type LegalRisk = "low" | "medium" | "high" | "very-high";
export type Tier = 1 | 2 | 3 | 4;

export interface CountryEntry {
  country_code: string;
  country_name: string;
  tier: Tier;
  validation_method: ValidationMethod;
  validation_method_description: string;
  data_source: string;
  data_source_url: string;
  licence: string;
  licence_url: string | null;
  cost: string;
  cost_description: string;
  legal_risk: LegalRisk;
  legal_risk_notes: string;
}

export const REGISTRY: Record<string, CountryEntry> = {
  FR: {
    country_code: "FR",
    country_name: "France",
    tier: 1,
    validation_method: "open-api",
    validation_method_description:
      "Address is looked up in real time against the Base Adresse Nationale (BAN), the official French national address database published by the government under an open licence. Returns normalised address and high-confidence result.",
    data_source: "Base Adresse Nationale (BAN)",
    data_source_url: "https://api-adresse.data.gouv.fr",
    licence: "ODbL-1.0",
    licence_url: "https://opendatacommons.org/licenses/odbl/1-0/",
    cost: "Free",
    cost_description:
      "The BAN API is free to use with no registration required. The data is published under ODbL 1.0 by the French government.",
    legal_risk: "low",
    legal_risk_notes:
      "Data is published under ODbL 1.0 by the Direction Interministérielle du Numérique (DINUM). Free redistribution and commercial use permitted with attribution and share-alike obligations.",
  },

  NL: {
    country_code: "NL",
    country_name: "Netherlands",
    tier: 1,
    validation_method: "open-api",
    validation_method_description:
      "Address is looked up in real time against the PDOK Locatieserver, which queries the BAG (Basisregistraties Adressen en Gebouwen) — the authoritative Dutch national address and buildings registry.",
    data_source: "PDOK Locatieserver (BAG)",
    data_source_url: "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free",
    licence: "CC0-1.0",
    licence_url: "https://creativecommons.org/publicdomain/zero/1.0/",
    cost: "Free",
    cost_description:
      "The PDOK Locatieserver is a free public API provided by the Dutch government. No API key or registration required.",
    legal_risk: "low",
    legal_risk_notes:
      "BAG data is published under CC0 1.0 by the Dutch government. No restrictions on use, redistribution, or commercial application.",
  },

  NO: {
    country_code: "NO",
    country_name: "Norway",
    tier: 1,
    validation_method: "open-api",
    validation_method_description:
      "Address is looked up in real time against the Kartverket national address API, Norway's authoritative national mapping authority.",
    data_source: "Kartverket National Address API",
    data_source_url: "https://ws.geonorge.no/adresser/v1/",
    licence: "NLOD-2.0",
    licence_url: "https://data.norge.no/nlod/en/2.0",
    cost: "Free",
    cost_description:
      "Kartverket's APIs are free to use. Data is published under the Norwegian Licence for Open Government Data (NLOD 2.0).",
    legal_risk: "low",
    legal_risk_notes:
      "NLOD 2.0 permits free use, redistribution, and commercial use with attribution. Maintained by the Norwegian Mapping Authority (Kartverket), a government agency.",
  },

  DK: {
    country_code: "DK",
    country_name: "Denmark",
    tier: 1,
    validation_method: "open-api",
    validation_method_description:
      "Address is looked up in real time against the Danish Address Web API (DAWA), operated by the Agency for Data Supply and Infrastructure.",
    data_source: "DAWA — Danmarks Adresser Web API",
    data_source_url: "https://api.datafordeler.dk",
    licence: "Danish-OGDL",
    licence_url: "https://www.retsinformation.dk/eli/lta/2016/746",
    cost: "Free",
    cost_description:
      "DAWA is a free public API with no registration required for basic use.",
    legal_risk: "low",
    legal_risk_notes:
      "Danish address data is published under the Danish Open Government Data Licence. Commercial use and redistribution are permitted with attribution.",
  },

  BE: {
    country_code: "BE",
    country_name: "Belgium",
    tier: 2,
    validation_method: "bulk-local",
    validation_method_description:
      "Address is validated against a locally ingested copy of the Belgian BOSA Best Address dataset (CC0). Postcode, city, street name, and house number are all verified. Brussels addresses are stored in both Dutch and French so validation succeeds in either language.",
    data_source: "BOSA Best Address (openaddress.bosa.be)",
    data_source_url: "https://opendata.bosa.be/download/best/",
    licence: "CC0-1.0",
    licence_url: "https://creativecommons.org/publicdomain/zero/1.0/",
    cost: "Free",
    cost_description:
      "BOSA Best Address open data is freely downloadable under CC0 1.0 with no registration required.",
    legal_risk: "low",
    legal_risk_notes:
      "CC0 1.0 — no restrictions on use or redistribution. BOSA (Belgian Federal Public Service Policy and Support) is the official Belgian government source for address data. Commercial use fully permitted.",
  },

  AT: {
    country_code: "AT",
    country_name: "Austria",
    tier: 3,
    validation_method: "bulk-local",
    validation_method_description:
      "Postcode and city are validated against a locally ingested copy of the GeoNames postal code dataset (CC BY 4.0). Street and house number cannot be verified at this time — the dataset provides postcode and locality coverage only.",
    data_source: "GeoNames postal codes",
    data_source_url: "https://download.geonames.org/export/zip/",
    licence: "CC-BY-4.0",
    licence_url: "https://creativecommons.org/licenses/by/4.0/",
    cost: "Free",
    cost_description: "GeoNames postal code data is freely downloadable under CC BY 4.0.",
    legal_risk: "low",
    legal_risk_notes:
      "CC BY 4.0 — attribution required. GeoNames data is compiled from national open data sources and is widely used for postcode/locality validation. Commercial use permitted.",
  },

  DE: {
    country_code: "DE",
    country_name: "Germany",
    tier: 3,
    validation_method: "bulk-local",
    validation_method_description:
      "Postcode and city are validated against a locally ingested copy of the GeoNames postal code dataset (CC BY 4.0). Street and house number cannot be verified at this time — the dataset provides postcode and locality coverage only.",
    data_source: "GeoNames postal codes",
    data_source_url: "https://download.geonames.org/export/zip/",
    licence: "CC-BY-4.0",
    licence_url: "https://creativecommons.org/licenses/by/4.0/",
    cost: "Free",
    cost_description: "GeoNames postal code data is freely downloadable under CC BY 4.0.",
    legal_risk: "low",
    legal_risk_notes:
      "CC BY 4.0 — attribution required. GeoNames data for Germany is compiled from official Länder open data sources. Commercial use permitted.",
  },

  IT: {
    country_code: "IT",
    country_name: "Italy",
    tier: 2,
    validation_method: "bulk-local",
    validation_method_description:
      "Address is validated against a locally ingested copy of the ANNCSU Indirizzario Nazionale (CC0), Italy's authoritative national civic address register managed jointly by ISTAT and the Agenzia delle Entrate. Postcode, city, street, and house number are all verified. Postcodes are resolved by spatial join with GeoNames IT postal codes.",
    data_source: "ANNCSU Indirizzario Nazionale",
    data_source_url: "https://www.anncsu.gov.it/",
    licence: "CC0-1.0",
    licence_url: "https://creativecommons.org/publicdomain/zero/1.0/",
    cost: "Free",
    cost_description:
      "ANNCSU open data is freely downloadable under CC0 1.0 with no registration required, pursuant to EU Regulation 2023/138 (High-Value Datasets).",
    legal_risk: "low",
    legal_risk_notes:
      "CC0 1.0 — no restrictions on use or redistribution. The ANNCSU is co-managed by ISTAT (Italian National Institute of Statistics) and Agenzia delle Entrate (Revenue Agency) as a high-value dataset under EU Regulation 2023/138. Commercial use fully permitted.",
  },

  ES: {
    country_code: "ES",
    country_name: "Spain",
    tier: 3,
    validation_method: "bulk-local",
    validation_method_description:
      "Postcode and city are validated against a locally ingested copy of the GeoNames postal code dataset (CC BY 4.0). Street and house number cannot be verified at this time — the dataset provides postcode and locality coverage only.",
    data_source: "GeoNames postal codes",
    data_source_url: "https://download.geonames.org/export/zip/",
    licence: "CC-BY-4.0",
    licence_url: "https://creativecommons.org/licenses/by/4.0/",
    cost: "Free",
    cost_description: "GeoNames postal code data is freely downloadable under CC BY 4.0.",
    legal_risk: "low",
    legal_risk_notes:
      "CC BY 4.0 — attribution required. GeoNames data for Spain is compiled from Catastro and other official Spanish open data. Commercial use permitted.",
  },

  PT: {
    country_code: "PT",
    country_name: "Portugal",
    tier: 3,
    validation_method: "bulk-local",
    validation_method_description:
      "Postcode and city are validated against a locally ingested copy of the GeoNames postal code dataset (CC BY 4.0). Street and house number cannot be verified at this time — the dataset provides postcode and locality coverage only.",
    data_source: "GeoNames postal codes",
    data_source_url: "https://download.geonames.org/export/zip/",
    licence: "CC-BY-4.0",
    licence_url: "https://creativecommons.org/licenses/by/4.0/",
    cost: "Free",
    cost_description: "GeoNames postal code data is freely downloadable under CC BY 4.0.",
    legal_risk: "low",
    legal_risk_notes:
      "CC BY 4.0 — attribution required. GeoNames data for Portugal is compiled from official Portuguese open government data. Commercial use permitted.",
  },

  SE: {
    country_code: "SE",
    country_name: "Sweden",
    tier: 3,
    validation_method: "bulk-local",
    validation_method_description:
      "Postcode and city are validated against a locally ingested copy of the GeoNames postal code dataset (CC BY 4.0). Street and house number cannot be verified at this time — the dataset provides postcode and locality coverage only.",
    data_source: "GeoNames postal codes",
    data_source_url: "https://download.geonames.org/export/zip/",
    licence: "CC-BY-4.0",
    licence_url: "https://creativecommons.org/licenses/by/4.0/",
    cost: "Free",
    cost_description: "GeoNames postal code data is freely downloadable under CC BY 4.0.",
    legal_risk: "low",
    legal_risk_notes:
      "CC BY 4.0 — attribution required. GeoNames data for Sweden is compiled from Lantmäteriet open data. Commercial use permitted.",
  },

  FI: {
    country_code: "FI",
    country_name: "Finland",
    tier: 3,
    validation_method: "bulk-local",
    validation_method_description:
      "Postcode and city are validated against a locally ingested copy of the GeoNames postal code dataset (CC BY 4.0). Street and house number cannot be verified at this time — the dataset provides postcode and locality coverage only.",
    data_source: "GeoNames postal codes",
    data_source_url: "https://download.geonames.org/export/zip/",
    licence: "CC-BY-4.0",
    licence_url: "https://creativecommons.org/licenses/by/4.0/",
    cost: "Free",
    cost_description: "GeoNames postal code data is freely downloadable under CC BY 4.0.",
    legal_risk: "low",
    legal_risk_notes:
      "CC BY 4.0 — attribution required. GeoNames data for Finland is compiled from National Land Survey of Finland open data. Commercial use permitted.",
  },

  PL: {
    country_code: "PL",
    country_name: "Poland",
    tier: 3,
    validation_method: "bulk-local",
    validation_method_description:
      "Postcode and city are validated against a locally ingested copy of the GeoNames postal code dataset (CC BY 4.0). Street and house number cannot be verified at this time — the dataset provides postcode and locality coverage only.",
    data_source: "GeoNames postal codes",
    data_source_url: "https://download.geonames.org/export/zip/",
    licence: "CC-BY-4.0",
    licence_url: "https://creativecommons.org/licenses/by/4.0/",
    cost: "Free",
    cost_description: "GeoNames postal code data is freely downloadable under CC BY 4.0.",
    legal_risk: "low",
    legal_risk_notes:
      "CC BY 4.0 — attribution required. GeoNames data for Poland is compiled from PRG (Polish Address Register) and other official sources. Commercial use permitted.",
  },

  CZ: {
    country_code: "CZ",
    country_name: "Czech Republic",
    tier: 3,
    validation_method: "bulk-local",
    validation_method_description:
      "Postcode and city are validated against a locally ingested copy of the GeoNames postal code dataset (CC BY 4.0). Street and house number cannot be verified at this time — the dataset provides postcode and locality coverage only.",
    data_source: "GeoNames postal codes",
    data_source_url: "https://download.geonames.org/export/zip/",
    licence: "CC-BY-4.0",
    licence_url: "https://creativecommons.org/licenses/by/4.0/",
    cost: "Free",
    cost_description: "GeoNames postal code data is freely downloadable under CC BY 4.0.",
    legal_risk: "low",
    legal_risk_notes:
      "CC BY 4.0 — attribution required. GeoNames data for the Czech Republic is compiled from ČÚZK (Czech Office for Surveying, Mapping and Cadastre) open data. Commercial use permitted.",
  },

  IE: {
    country_code: "IE",
    country_name: "Ireland",
    tier: 3,
    validation_method: "format+reference",
    validation_method_description:
      "Eircode format is validated by regex and cross-checked against a postcode reference table. The authoritative Eircode database is commercially licensed and not available under an open licence.",
    data_source: "postcode-validator (format) + open reference data",
    data_source_url: "https://www.npmjs.com/package/postcode-validator",
    licence: "MIT",
    licence_url: "https://opensource.org/licenses/MIT",
    cost: "Free (format check) / €commercial (full Eircode database)",
    cost_description:
      "Format-only validation is free using open-source libraries. The full authoritative Eircode database requires a commercial licence from An Post.",
    legal_risk: "medium",
    legal_risk_notes:
      "Eircode postcode system is managed by Capita Business Support on behalf of the Irish government. The full ECAD (Eircode Address Database) is commercially licensed. Format-only validation carries no licensing risk, but the check is shallow. Full address validation requires purchasing access to ECAD.",
  },

  CH: {
    country_code: "CH",
    country_name: "Switzerland",
    tier: 3,
    validation_method: "format+reference",
    validation_method_description:
      "Swiss postcode format is validated by regex and cross-checked against Swiss Post's publicly available postcode list.",
    data_source: "Swiss Post postcode list + postcode-validator",
    data_source_url: "https://www.post.ch/en/business/a-z-of-subjects/address-management-data/swiss-zip-code-directory",
    licence: "Swiss-Post-Terms",
    licence_url: null,
    cost: "Free (format/postcode check)",
    cost_description:
      "Format and postcode validation is free. The Swiss Post postcode list is publicly available for reference use.",
    legal_risk: "low",
    legal_risk_notes:
      "Swiss Post publishes its postcode directory for public reference use. Postcode format validation has minimal legal risk. For full authoritative address validation, swisstopo publishes Swiss address data under an open government data licence.",
  },

  LU: {
    country_code: "LU",
    country_name: "Luxembourg",
    tier: 3,
    validation_method: "format+reference",
    validation_method_description:
      "Luxembourg postcode format is validated by regex. Luxembourg uses a 4-digit numeric postcode system.",
    data_source: "postcode-validator",
    data_source_url: "https://www.npmjs.com/package/postcode-validator",
    licence: "MIT",
    licence_url: "https://opensource.org/licenses/MIT",
    cost: "Free",
    cost_description: "Format validation only, using open-source libraries.",
    legal_risk: "low",
    legal_risk_notes:
      "Luxembourg's ACT (Administration du Cadastre et de la Topographie) publishes some open geodata. Format-only validation carries no licensing risk.",
  },

  HU: {
    country_code: "HU",
    country_name: "Hungary",
    tier: 3,
    validation_method: "format-only",
    validation_method_description:
      "Hungarian postcode format is validated by regex only (4-digit numeric). No openly licensed authoritative address dataset is currently available.",
    data_source: "postcode-validator",
    data_source_url: "https://www.npmjs.com/package/postcode-validator",
    licence: "MIT",
    licence_url: "https://opensource.org/licenses/MIT",
    cost: "Free (format check only)",
    cost_description: "Format validation only, using open-source libraries.",
    legal_risk: "medium",
    legal_risk_notes:
      "No fully open national address dataset is available for Hungary. The FÖMI (Institute of Geodesy, Cartography and Remote Sensing) manages address data under restricted terms. Format-only validation carries no risk but provides low confidence.",
  },

  RO: {
    country_code: "RO",
    country_name: "Romania",
    tier: 3,
    validation_method: "format-only",
    validation_method_description:
      "Romanian postcode format is validated by regex only (6-digit numeric). No openly licensed authoritative address dataset is currently available.",
    data_source: "postcode-validator",
    data_source_url: "https://www.npmjs.com/package/postcode-validator",
    licence: "MIT",
    licence_url: "https://opensource.org/licenses/MIT",
    cost: "Free (format check only)",
    cost_description: "Format validation only, using open-source libraries.",
    legal_risk: "medium",
    legal_risk_notes:
      "No openly licensed national address dataset is available for Romania. ANCPI (National Agency for Cadastre and Land Registration) manages address data under restricted terms. Format-only validation carries no risk but provides low confidence.",
  },

  GB: {
    country_code: "GB",
    country_name: "United Kingdom",
    tier: 4,
    validation_method: "restricted",
    validation_method_description:
      "Authoritative UK address data is not freely available. The Royal Mail Postcode Address File (PAF) and Ordnance Survey AddressBase products are commercially licensed. This API does not attempt validation and returns a clear explanation.",
    data_source: "Royal Mail PAF / OS AddressBase (commercial)",
    data_source_url: "https://www.royalmail.com/business/data/postcode-address-file",
    licence: "Commercial",
    licence_url: null,
    cost: "Commercial licensing required — typically £thousands per year",
    cost_description:
      "Royal Mail PAF licences start at several thousand pounds per year for basic use and scale significantly with volume and application type. OS AddressBase (which includes UPRN — Unique Property Reference Numbers) is licensed through the Public Sector Mapping Agreement (PSMA) for public sector bodies, but commercial use requires separate negotiation with Ordnance Survey. Costs for commercial licensees can reach tens of thousands of pounds annually.",
    legal_risk: "medium",
    legal_risk_notes:
      "UK address data carries very high legal risk for three distinct but overlapping reasons:\n\n" +
      "1. **Commercial monopoly on postal addresses**: The Postcode Address File and AddressBase are the definitive UK address databases and are commercially licensed by Royal Mail and Ordnance Survey. Use without a licence is a breach of copyright; unlicensed scraping, copying, or redistribution has been subject to legal action. Licences are tiered by use case and volume and typically cost several thousand pounds per year at minimum.\n\n" +
      "2. **OS are funded to open UPRNs but address attributes remain commercial**: UPRN identifiers themselves became open data under the Open Government Licence in 2020. However, the address *attributes* linked to those identifiers — street name, locality, postcode, coordinates — come from OS AddressBase, which is commercially licensed for private-sector use. Publishing a usable address record (UPRN + address fields) derived from AddressBase without a licence is where the legal risk lies.\n\n" +
      "3. **Third-party rights silently embedded in public sector data**: This is the least visible risk. Local authorities compile and maintain address lists (including Council Tax property lists) and routinely release them under the Open Government Licence. However, Ordnance Survey and GeoPlace LLP claim that most such lists contain their IP — because the council used OS/GeoPlace datasets during compilation or maintenance — and that the council therefore had no right to sub-license those third-party rights. OS has issued cease-and-desist letters forcing the removal of OGL-released datasets from 57 local authorities. The difficulty for end users is that this contamination is invisible: two address lists for the same properties can appear identical on the page regardless of whether they were compiled independently or derived from OS sources, because both are formatted to the same technical standard. The concept OS uses to identify 'clean' council data — 'Authority Owned Data', defined in the GeoPlace Data Co-operation Agreement — is a contractual term, not a legal one. Whether routine operations such as checking, formatting, or cross-referencing against a council's Local Land and Property Gazetteer (LLPG) constitute legal 'derivation' from OS IP is undefined in statute and untested in case law. In practice, neither the council, nor OS, nor the end user can reliably determine by inspection whether a given dataset is safe to re-use. The Royal Mail have also argued similarly in other cases.\n\n" +
      "4. **No open alternative**: Unlike France, Germany, the Netherlands, and most of continental Europe, the UK has no government-published open-licence address dataset suitable for general application use. The OS Open Names dataset covers place names only, not property-level addresses.\n\n" +
      "5. **Contrast with Europe**: Most EU member states publish authoritative national address data under open licences (CC0, CC BY, ODbL) as a matter of policy. The UK's overlapping commercial interests — Royal Mail, Ordnance Survey, and GeoPlace LLP — and the opacity of their licensing frameworks make the legal risk of building address-dependent services significantly higher than anywhere else covered by this API.",
  },
};

export function getCountry(code: string): CountryEntry | undefined {
  return REGISTRY[code.toUpperCase()];
}

export function getAllCountries(): CountryEntry[] {
  return Object.values(REGISTRY);
}

export function getCountriesByTier(tier: Tier): CountryEntry[] {
  return Object.values(REGISTRY).filter((c) => c.tier === tier);
}
