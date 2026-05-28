import type { AddressInput, NormalisedAddress, ValidationResult } from "./types.js";
import { UpstreamError } from "./types.js";
import { isOpen, retryAfterSeconds, recordSuccess, recordFailure } from "../circuit-breaker.js";

const TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(id);
  }
}

function assertCircuitClosed(key: string): void {
  if (isOpen(key)) {
    const after = retryAfterSeconds(key);
    const err = new UpstreamError(
      `Upstream service '${key}' is temporarily unavailable (circuit open). Retry after ${after}s.`,
      503,
    );
    (err as any).retryAfter = after;
    throw err;
  }
}

export async function validateFR(
  input: AddressInput,
): Promise<ValidationResult> {
  const key = "FR";
  assertCircuitClosed(key);

  const parts: string[] = [];
  if (input.house_number) parts.push(input.house_number);
  if (input.street) parts.push(input.street);
  if (parts.length === 0) parts.push(input.postcode);

  const q = encodeURIComponent(parts.join(" "));
  const url = `https://api-adresse.data.gouv.fr/search/?q=${q}&postcode=${encodeURIComponent(input.postcode)}&limit=1`;

  let resp: Response;
  try {
    resp = await fetchWithTimeout(url);
  } catch (err) {
    recordFailure(key);
    throw new UpstreamError(
      `Base Adresse Nationale API unreachable: ${(err as Error).message}`,
    );
  }

  if (!resp.ok) {
    recordFailure(key);
    throw new UpstreamError(
      `Base Adresse Nationale API returned HTTP ${resp.status}`,
    );
  }

  recordSuccess(key);

  const data = (await resp.json()) as {
    features: Array<{
      properties: {
        label?: string;
        score?: number;
        housenumber?: string;
        street?: string;
        city?: string;
        postcode?: string;
        type?: string;
      };
    }>;
  };

  if (!data.features || data.features.length === 0) {
    return {
      valid: false,
      confidence: "high",
      method: "open-api",
      source: "Base Adresse Nationale (BAN)",
      source_url: "https://api-adresse.data.gouv.fr",
      licence: "ODbL-1.0",
      normalised_address: { country_code: "FR", postcode: input.postcode },
      warnings: ["Address not found in the Base Adresse Nationale"],
    };
  }

  const f = data.features[0].properties;
  const score = f.score ?? 0;

  const normalised: NormalisedAddress = {
    house_number: f.housenumber ?? null,
    street: f.street ?? null,
    city: f.city ?? null,
    postcode: f.postcode ?? null,
    country_code: "FR",
  };

  const warnings: string[] = [];
  if (score < 0.7) {
    warnings.push(
      `Low geocode match score (${score.toFixed(2)}) — result is the nearest match and may be approximate`,
    );
  }
  if (!input.street && !input.house_number) {
    warnings.push(
      "Only postcode was provided; result is the first matching address in this postcode area",
    );
  }

  return {
    valid: true,
    confidence: "high",
    method: "open-api",
    source: "Base Adresse Nationale (BAN)",
    source_url: "https://api-adresse.data.gouv.fr",
    licence: "ODbL-1.0",
    normalised_address: normalised,
    warnings,
  };
}

export async function validateNL(
  input: AddressInput,
): Promise<ValidationResult> {
  const key = "NL";
  assertCircuitClosed(key);

  const parts: string[] = [input.postcode];
  if (input.house_number) parts.push(input.house_number);

  const q = encodeURIComponent(parts.join(" "));
  const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${q}&fq=type:adres&rows=1`;

  let resp: Response;
  try {
    resp = await fetchWithTimeout(url);
  } catch (err) {
    recordFailure(key);
    throw new UpstreamError(
      `PDOK Locatieserver API unreachable: ${(err as Error).message}`,
    );
  }

  if (!resp.ok) {
    recordFailure(key);
    throw new UpstreamError(`PDOK Locatieserver API returned HTTP ${resp.status}`);
  }

  recordSuccess(key);

  const data = (await resp.json()) as {
    response: {
      numFound: number;
      docs: Array<{
        huisnummer?: string;
        straatnaam?: string;
        woonplaatsnaam?: string;
        postcode?: string;
        score?: number;
      }>;
    };
  };

  if (data.response.numFound === 0) {
    return {
      valid: false,
      confidence: "high",
      method: "open-api",
      source: "PDOK Locatieserver (BAG)",
      source_url: "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free",
      licence: "CC0-1.0",
      normalised_address: { country_code: "NL", postcode: input.postcode },
      warnings: ["Address not found in the Dutch BAG register"],
    };
  }

  const doc = data.response.docs[0];

  const normalised: NormalisedAddress = {
    house_number: doc.huisnummer ?? null,
    street: doc.straatnaam ?? null,
    city: doc.woonplaatsnaam ?? null,
    postcode: doc.postcode ?? null,
    country_code: "NL",
  };

  const warnings: string[] = [];
  if (!input.street && !input.house_number) {
    warnings.push(
      "Only postcode was provided; result is the first matching address in this postcode area",
    );
  }

  return {
    valid: true,
    confidence: "high",
    method: "open-api",
    source: "PDOK Locatieserver (BAG)",
    source_url: "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free",
    licence: "CC0-1.0",
    normalised_address: normalised,
    warnings,
  };
}

export async function validateNO(
  input: AddressInput,
): Promise<ValidationResult> {
  const key = "NO";
  assertCircuitClosed(key);

  const params = new URLSearchParams({
    postnummer: input.postcode,
    treffPerSide: "1",
    side: "0",
  });
  if (input.street) params.set("adressenavn", input.street);
  if (input.house_number) params.set("nummer", input.house_number);
  if (input.city) params.set("poststed", input.city);

  const url = `https://ws.geonorge.no/adresser/v1/sok?${params.toString()}`;

  let resp: Response;
  try {
    resp = await fetchWithTimeout(url);
  } catch (err) {
    recordFailure(key);
    throw new UpstreamError(
      `Kartverket API unreachable: ${(err as Error).message}`,
    );
  }

  if (!resp.ok) {
    recordFailure(key);
    throw new UpstreamError(`Kartverket API returned HTTP ${resp.status}`);
  }

  recordSuccess(key);

  const data = (await resp.json()) as {
    metadata?: { totaltAntallTreff?: number };
    totaltAntallTreff?: number;
    adresser: Array<{
      nummer?: number | string;
      adressenavn?: string;
      poststed?: string;
      postnummer?: string;
    }>;
  };

  const totalHits =
    data.metadata?.totaltAntallTreff ?? data.totaltAntallTreff ?? 0;

  if (totalHits === 0 || !data.adresser || data.adresser.length === 0) {
    return {
      valid: false,
      confidence: "high",
      method: "open-api",
      source: "Kartverket National Address API",
      source_url: "https://ws.geonorge.no/adresser/v1/",
      licence: "NLOD-2.0",
      normalised_address: { country_code: "NO", postcode: input.postcode },
      warnings: ["Address not found in the Kartverket national address register"],
    };
  }

  const addr = data.adresser[0]!;
  const normalised: NormalisedAddress = {
    house_number: addr.nummer != null ? String(addr.nummer) : null,
    street: addr.adressenavn ?? null,
    city: addr.poststed ?? null,
    postcode: addr.postnummer ?? null,
    country_code: "NO",
  };

  const warnings: string[] = [];
  if (!input.street && !input.house_number) {
    warnings.push(
      "Only postcode was provided; result is the first matching address in this postcode area",
    );
  }

  return {
    valid: true,
    confidence: "high",
    method: "open-api",
    source: "Kartverket National Address API",
    source_url: "https://ws.geonorge.no/adresser/v1/",
    licence: "NLOD-2.0",
    normalised_address: normalised,
    warnings,
  };
}

export async function validateDK(
  input: AddressInput,
): Promise<ValidationResult> {
  const key = "DK";
  assertCircuitClosed(key);

  const params = new URLSearchParams({ postnr: input.postcode, per_side: "1" });
  if (input.street) params.set("vejnavn", input.street);
  if (input.house_number) params.set("husnr", input.house_number);

  const url = `https://api.datafordeler.dk/DAR/DAR/3.0.0/rest/adresse?${params.toString()}&MedtagUgyldige=false`;

  let resp: Response;
  try {
    resp = await fetchWithTimeout(url);
  } catch (err) {
    recordFailure(key);
    throw new UpstreamError(
      `Datafordeler (DAWA) API unreachable: ${(err as Error).message}`,
    );
  }

  if (!resp.ok) {
    const dawaParams = new URLSearchParams({ postnr: input.postcode, per_side: "1" });
    if (input.street) dawaParams.set("vejnavn", input.street);
    if (input.house_number) dawaParams.set("husnr", input.house_number);

    const dawaUrl = `https://dawa.aws.dk/adgangsadresser?${dawaParams.toString()}`;
    try {
      resp = await fetchWithTimeout(dawaUrl);
    } catch (err2) {
      recordFailure(key);
      throw new UpstreamError(
        `Danish address APIs unreachable: ${(err2 as Error).message}`,
      );
    }
  }

  if (!resp.ok) {
    recordFailure(key);
    throw new UpstreamError(`Danish address API returned HTTP ${resp.status}`);
  }

  recordSuccess(key);

  const data = (await resp.json()) as Array<{
    husnr?: string;
    vejnavn?: string;
    postnrnavn?: string;
    postnr?: string;
  }>;

  if (!Array.isArray(data) || data.length === 0) {
    return {
      valid: false,
      confidence: "high",
      method: "open-api",
      source: "DAWA — Danmarks Adresser Web API",
      source_url: "https://dawa.aws.dk",
      licence: "Danish-OGDL",
      normalised_address: { country_code: "DK", postcode: input.postcode },
      warnings: ["Address not found in the Danish address register"],
    };
  }

  const addr = data[0];
  const normalised: NormalisedAddress = {
    house_number: addr.husnr ?? null,
    street: addr.vejnavn ?? null,
    city: addr.postnrnavn ?? null,
    postcode: addr.postnr ?? null,
    country_code: "DK",
  };

  const warnings: string[] = [];
  if (!input.street && !input.house_number) {
    warnings.push(
      "Only postcode was provided; result is the first matching address in this postcode area",
    );
  }

  return {
    valid: true,
    confidence: "high",
    method: "open-api",
    source: "DAWA — Danmarks Adresser Web API",
    source_url: "https://dawa.aws.dk",
    licence: "Danish-OGDL",
    normalised_address: normalised,
    warnings,
  };
}
