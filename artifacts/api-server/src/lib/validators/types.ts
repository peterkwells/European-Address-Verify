export type Confidence = "high" | "medium" | "low" | "unknown";
export type ValidationMethod =
  | "open-api"
  | "bulk-local"
  | "format+reference"
  | "format-only"
  | "restricted";

export interface NormalisedAddress {
  house_number?: string | null;
  street?: string | null;
  city?: string | null;
  postcode?: string | null;
  country_code: string;
}

export interface ValidationResult {
  valid: boolean | null;
  confidence: Confidence;
  method: ValidationMethod;
  source: string;
  source_url: string;
  licence: string;
  normalised_address: NormalisedAddress | null;
  warnings: string[];
}

export interface AddressInput {
  country: string;
  postcode: string;
  city?: string;
  street?: string;
  house_number?: string;
}

export class UpstreamError extends Error {
  public readonly retryAfter?: number;

  constructor(
    message: string,
    public readonly statusCode: number = 502,
    retryAfter?: number,
  ) {
    super(message);
    this.name = "UpstreamError";
    if (retryAfter !== undefined) {
      this.retryAfter = retryAfter;
    }
  }
}

export class DatasetNotIngestedError extends Error {
  constructor(public readonly country: string) {
    super(
      `Dataset for ${country} has not been ingested yet. Run the ingestion script first.`,
    );
    this.name = "DatasetNotIngestedError";
  }
}
