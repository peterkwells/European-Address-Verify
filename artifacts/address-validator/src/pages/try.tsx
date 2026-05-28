import { useState, useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useListCoverage,
  useValidateAddress,
  getValidateAddressQueryKey,
} from "@workspace/api-client-react";
import type { ValidateAddressParams, CountryCoverage } from "@workspace/api-client-react";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Info,
  Zap,
  Database,
  FileSearch,
  FileX,
  Lock,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Schemas ────────────────────────────────────────────────────────────────

const schema = z.object({
  country: z.string().min(2, "Select a country"),
  postcode: z.string().min(1, "Postcode is required"),
  city: z.string().optional(),
  street: z.string().optional(),
  house_number: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// ─── Method metadata ─────────────────────────────────────────────────────────

type MethodKey = "open-api" | "bulk-local" | "format+reference" | "format-only" | "restricted";

interface MethodMeta {
  icon: React.ReactNode;
  label: string;
  badge: string;
  maxConfidence: "high" | "medium" | "low" | "none";
  validates: string[];
  doesNotValidate: string[];
  tip: string | null;
}

const METHOD_META: Record<MethodKey, MethodMeta> = {
  "open-api": {
    icon: <Zap className="h-3.5 w-3.5" />,
    label: "Live National API",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    maxConfidence: "high",
    validates: ["Postcode", "City", "Street name", "House number"],
    doesNotValidate: [],
    tip: "Add a street and house number to confirm the exact address exists.",
  },
  "bulk-local": {
    icon: <Database className="h-3.5 w-3.5" />,
    label: "Local Address Dataset",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    maxConfidence: "high",
    validates: ["Postcode", "City", "Street name", "House number"],
    doesNotValidate: [],
    tip: "Add a street and house number to get a high-confidence result.",
  },
  "format+reference": {
    icon: <FileSearch className="h-3.5 w-3.5" />,
    label: "Format + City Reference",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    maxConfidence: "medium",
    validates: ["Postcode format", "City cross-reference"],
    doesNotValidate: ["Street name", "House number"],
    tip: "Street and house number are accepted but cannot be verified for this country.",
  },
  "format-only": {
    icon: <FileX className="h-3.5 w-3.5" />,
    label: "Postcode Format Only",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    maxConfidence: "low",
    validates: ["Postcode format"],
    doesNotValidate: ["City", "Street name", "House number"],
    tip: null,
  },
  restricted: {
    icon: <Lock className="h-3.5 w-3.5" />,
    label: "Restricted",
    badge: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    maxConfidence: "none",
    validates: [],
    doesNotValidate: ["Postcode", "City", "Street name", "House number"],
    tip: null,
  },
};

// ─── Confidence helpers ──────────────────────────────────────────────────────

const CONFIDENCE_META: Record<string, { label: string; desc: string; pct: number; bar: string; text: string }> = {
  high:    { label: "High",    desc: "Full address matched against authoritative source", pct: 100, bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  medium:  { label: "Medium",  desc: "Postcode + city matched",                           pct: 66,  bar: "bg-amber-500",  text: "text-amber-700 dark:text-amber-400" },
  low:     { label: "Low",     desc: "Postcode format only",                              pct: 33,  bar: "bg-orange-500", text: "text-orange-700 dark:text-orange-400" },
  unknown: { label: "Unknown", desc: "Restricted or unavailable",                         pct: 0,   bar: "bg-muted",      text: "text-muted-foreground" },
};

function expectedConfidence(
  method: MethodKey,
  values: Partial<FormValues>,
): "high" | "medium" | "low" | "unknown" {
  if (method === "restricted") return "unknown";
  if (method === "format-only") return values.postcode ? "low" : "unknown";
  if (method === "format+reference") {
    return values.city ? "medium" : "low";
  }
  // open-api or bulk-local
  if (values.house_number && values.street) return "high";
  if (values.street || values.city) return "medium";
  return "low";
}

// ─── Example addresses ───────────────────────────────────────────────────────

interface ExampleAddress {
  country: string;
  postcode: string;
  city: string;
  street: string;
  house_number: string;
  label: string;
  note?: string;
}

const EXAMPLE_ADDRESSES: ExampleAddress[] = [
  { country: "FR", postcode: "75001", city: "Paris",      street: "Rue de Rivoli",   house_number: "12",  label: "Paris, France" },
  { country: "NL", postcode: "1012NX", city: "Amsterdam", street: "Kalverstraat",    house_number: "92",  label: "Amsterdam, NL" },
  { country: "NO", postcode: "0159",  city: "Oslo",       street: "Karl Johans gate",house_number: "1",   label: "Oslo, Norway" },
  { country: "DE", postcode: "10117", city: "Berlin",     street: "Unter den Linden",house_number: "1",   label: "Berlin, Germany" },
  { country: "GB", postcode: "SW1A 1AA", city: "London",  street: "",               house_number: "",    label: "London, UK", note: "restricted" },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function CapabilityBanner({ country }: { country: CountryCoverage }) {
  const method = (country.validation_method ?? "restricted") as MethodKey;
  const meta = METHOD_META[method] ?? METHOD_META.restricted;

  return (
    <div
      className="rounded-lg border border-border bg-muted/30 p-3 space-y-2"
      data-testid="capability-banner"
    >
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.badge}`}>
          {meta.icon}
          {meta.label}
        </span>
        <span className="text-xs text-muted-foreground">{country.country_name}</span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {meta.validates.length > 0 && (
          <div>
            <p className="font-medium text-foreground mb-0.5">Validates</p>
            {meta.validates.map((f) => (
              <div key={f} className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        )}
        {meta.doesNotValidate.length > 0 && (
          <div>
            <p className="font-medium text-foreground mb-0.5">Cannot verify</p>
            {meta.doesNotValidate.map((f) => (
              <div key={f} className="flex items-center gap-1 text-muted-foreground">
                <XCircle className="h-3 w-3 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        )}
      </div>

      {meta.tip && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3 w-3 shrink-0 mt-0.5 text-primary" />
          {meta.tip}
        </div>
      )}
    </div>
  );
}

function ConfidencePreview({
  method,
  values,
}: {
  method: MethodKey;
  values: Partial<FormValues>;
}) {
  if (!values.postcode) return null;
  const conf = expectedConfidence(method, values);
  const meta = CONFIDENCE_META[conf];

  const steps: { label: string; conf: "high" | "medium" | "low" | "unknown"; reached: boolean }[] = [];

  if (method === "open-api" || method === "bulk-local") {
    steps.push(
      { label: "Postcode", conf: "low",    reached: !!values.postcode },
      { label: "+ Street", conf: "medium", reached: !!values.street || !!values.city },
      { label: "+ House no.", conf: "high", reached: !!values.house_number && !!values.street },
    );
  } else if (method === "format+reference") {
    steps.push(
      { label: "Postcode",  conf: "low",    reached: !!values.postcode },
      { label: "+ City",    conf: "medium", reached: !!values.city },
    );
  }

  if (steps.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3" data-testid="confidence-preview">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">Expected confidence</p>
        <span className={`text-xs font-semibold ${meta.text}`}>{meta.label}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-300 ${meta.bar}`}
          style={{ width: `${meta.pct}%` }}
        />
      </div>
      <div className="flex items-center gap-1">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground text-[10px]">→</span>}
            <span
              className={[
                "text-[11px] font-medium rounded px-1.5 py-0.5",
                step.reached
                  ? CONFIDENCE_META[step.conf].text + " bg-muted"
                  : "text-muted-foreground/50",
              ].join(" ")}
            >
              {step.label}: {step.conf}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ValidIcon({ valid }: { valid: boolean | null }) {
  if (valid === true)  return <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
  if (valid === false) return <XCircle      className="h-5 w-5 text-red-600 dark:text-red-400" />;
  return <HelpCircle className="h-5 w-5 text-muted-foreground" />;
}

function ResultRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-xs font-medium text-muted-foreground shrink-0 w-36">{label}</span>
      <span className="text-xs text-foreground text-right">{value}</span>
    </div>
  );
}

function JsonHighlight({ json }: { json: unknown }) {
  const lines = JSON.stringify(json, null, 2).split("\n");
  return (
    <pre className="overflow-x-auto p-4 text-xs leading-relaxed font-mono" data-testid="result-raw-json">
      {lines.map((line, i) => {
        const m = line.match(/^(\s*)("[\w_]+")(: )(.*)$/);
        if (m) {
          const [, indent, key, colon, rest] = m;
          let val: React.ReactNode = rest;
          if (rest === "true" || rest === "false")  val = <span className="text-amber-600 dark:text-amber-400">{rest}</span>;
          else if (rest === "null")                  val = <span className="text-muted-foreground">{rest}</span>;
          else if (/^-?\d/.test(rest))              val = <span className="text-blue-600 dark:text-blue-400">{rest}</span>;
          else if (rest.startsWith('"'))            val = <span className="text-emerald-700 dark:text-emerald-400">{rest}</span>;
          return (
            <span key={i}>
              {indent}<span className="text-violet-700 dark:text-violet-400">{key}</span>{colon}{val}{"\n"}
            </span>
          );
        }
        return <span key={i}>{line + "\n"}</span>;
      })}
    </pre>
  );
}

// ─── Placeholder to satisfy non-optional hook param ──────────────────────────
const PLACEHOLDER_PARAMS: ValidateAddressParams = { country: "XX", postcode: "00000" };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Try() {
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const { data: coverageData } = useListCoverage();
  const [submittedParams, setSubmittedParams] = useState<ValidateAddressParams | null>(null);

  const countryFromUrl = useMemo(() => {
    return new URLSearchParams(searchStr).get("country") ?? "";
  }, [searchStr]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { country: countryFromUrl, postcode: "", city: "", street: "", house_number: "" },
  });

  useEffect(() => {
    if (countryFromUrl) form.setValue("country", countryFromUrl, { shouldValidate: false });
  }, [countryFromUrl, form]);

  const watchedValues = useWatch({ control: form.control });

  const selectedCountry = useMemo(
    () => coverageData?.countries.find((c) => c.country_code === watchedValues.country),
    [coverageData, watchedValues.country],
  );

  const selectedMethod = (selectedCountry?.validation_method ?? "restricted") as MethodKey;

  // Dynamic examples: use coverage-driven list, fall back to hardcoded ones
  const exampleAddresses = useMemo<ExampleAddress[]>(() => {
    if (!coverageData?.countries) return [];
    const codes = new Set(coverageData.countries.map((c) => c.country_code));
    return EXAMPLE_ADDRESSES.filter((e) => codes.has(e.country));
  }, [coverageData]);

  const activeParams = submittedParams ?? PLACEHOLDER_PARAMS;
  const { data: result, isLoading, error, isFetching } = useValidateAddress(activeParams, {
    query: {
      enabled: submittedParams !== null,
      queryKey: getValidateAddressQueryKey(activeParams),
    },
  });

  function onSubmit(values: FormValues) {
    setSubmittedParams({
      country: values.country,
      postcode: values.postcode,
      ...(values.city         ? { city: values.city }                 : {}),
      ...(values.street       ? { street: values.street }             : {}),
      ...(values.house_number ? { house_number: values.house_number } : {}),
    });
  }

  function loadExample(ex: ExampleAddress) {
    form.setValue("country",      ex.country);
    form.setValue("postcode",     ex.postcode);
    form.setValue("city",         ex.city);
    form.setValue("street",       ex.street);
    form.setValue("house_number", ex.house_number);
    setSubmittedParams(null);
  }

  const apiError = error as { data?: { message?: string } } | null;
  const confidenceMeta = result ? CONFIDENCE_META[result.confidence] : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="heading-try">
          API Explorer
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Validate a full European address — postcode, city, street, and house number — using
          authoritative national sources.
        </p>
      </div>

      {/* Quick examples */}
      {exampleAddresses.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Quick examples — click to pre-fill
          </p>
          <div className="flex flex-wrap gap-2">
            {exampleAddresses.map((ex) => (
              <button
                key={ex.country}
                data-testid={`button-example-${ex.country.toLowerCase()}`}
                onClick={() => loadExample(ex)}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground text-left"
              >
                <span className="font-mono mr-1 text-muted-foreground/70">{ex.country}</span>
                {ex.label}
                {ex.street && (
                  <span className="block text-[10px] text-muted-foreground/60 font-normal mt-0.5">
                    {ex.house_number} {ex.street}
                  </span>
                )}
                {ex.note === "restricted" && (
                  <span className="ml-1 text-red-500 text-[10px]">(restricted)</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Form ── */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Address Input</h2>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Country */}
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Country *</FormLabel>
                    <Select onValueChange={(v) => { field.onChange(v); setSubmittedParams(null); }} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-country" className="text-sm">
                          <SelectValue placeholder="Select a country…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {coverageData?.countries.map((c) => (
                          <SelectItem key={c.country_code} value={c.country_code} data-testid={`option-country-${c.country_code}`}>
                            <span className="font-mono text-xs text-muted-foreground mr-2">{c.country_code}</span>
                            {c.country_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Capability banner — shown as soon as a country is selected */}
              {selectedCountry && <CapabilityBanner country={selectedCountry} />}

              {/* Postcode */}
              <FormField
                control={form.control}
                name="postcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Postcode *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-postcode" placeholder="e.g. 75001" className="font-mono text-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Street + House number — visually primary for full address */}
              <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Full address fields
                  {(selectedMethod === "open-api" || selectedMethod === "bulk-local") && (
                    <span className="ml-auto text-[10px] font-normal text-emerald-700 dark:text-emerald-400">
                      verified by {selectedMethod === "open-api" ? "live API" : "local dataset"}
                    </span>
                  )}
                  {(selectedMethod === "format+reference" || selectedMethod === "format-only") && (
                    <span className="ml-auto text-[10px] font-normal text-muted-foreground">not verifiable for this country</span>
                  )}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <FormField
                    control={form.control}
                    name="house_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">House No.</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-house-number" placeholder="e.g. 12" className="text-sm" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="street"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel className="text-xs font-medium">Street name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-street" placeholder="e.g. Rue de Rivoli" className="text-sm" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">City</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-city" placeholder="e.g. Paris" className="text-sm" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Live confidence preview */}
              {selectedCountry && watchedValues.postcode && (
                <ConfidencePreview method={selectedMethod} values={watchedValues} />
              )}

              <Button type="submit" data-testid="button-validate" className="w-full" disabled={isFetching}>
                {isFetching ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Validating…</>
                ) : (
                  "Validate Address"
                )}
              </Button>
            </form>
          </Form>
        </div>

        {/* ── Result ── */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Result</h2>

          {!submittedParams && !result && (
            <div className="flex h-48 flex-col items-center justify-center text-center text-muted-foreground" data-testid="state-empty-result">
              <HelpCircle className="mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">Submit an address to see the validation result</p>
            </div>
          )}

          {isLoading && (
            <div className="flex h-48 flex-col items-center justify-center text-muted-foreground" data-testid="state-loading-result">
              <Loader2 className="mb-2 h-6 w-6 animate-spin" />
              <p className="text-sm">Validating…</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4" data-testid="state-error-result">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">Validation failed</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {apiError?.data?.message ?? (error as Error).message ?? "Unknown error"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {result && !isLoading && (
            <div data-testid="result-panel" className="space-y-4">
              {/* Valid status */}
              <div className="flex items-center gap-3">
                <ValidIcon valid={result.valid} />
                <div>
                  <p className="text-sm font-semibold text-foreground" data-testid="result-valid">
                    {result.valid === true ? "Address is valid" : result.valid === false ? "Address is invalid" : "Validity unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Source:{" "}
                    <a href={result.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" data-testid="link-source-url">
                      {result.source}
                    </a>
                  </p>
                </div>
              </div>

              {/* Confidence bar */}
              {confidenceMeta && (
                <div data-testid="result-confidence">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">Confidence</span>
                    <span className={`text-xs font-semibold ${confidenceMeta.text}`}>{confidenceMeta.label}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${confidenceMeta.bar}`} style={{ width: `${confidenceMeta.pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{confidenceMeta.desc}</p>
                </div>
              )}

              {/* Summary rows */}
              <div className="rounded-md border border-border bg-muted/30 px-4">
                <ResultRow label="Method" value={result.method} />
                <ResultRow label="Licence" value={<code className="text-xs font-mono">{result.licence}</code>} />
                {result.normalised_address?.postcode     && <ResultRow label="Postcode (norm.)"     value={<code className="text-xs font-mono">{result.normalised_address.postcode}</code>} />}
                {result.normalised_address?.city         && <ResultRow label="City (norm.)"         value={result.normalised_address.city} />}
                {result.normalised_address?.street       && <ResultRow label="Street (norm.)"       value={result.normalised_address.street} />}
                {result.normalised_address?.house_number && <ResultRow label="House no. (norm.)"    value={result.normalised_address.house_number} />}
              </div>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30" data-testid="result-warnings">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div className="space-y-1">
                      {result.warnings.map((w, i) => (
                        <p key={i} className="text-xs text-amber-700 dark:text-amber-300">{w}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Raw JSON */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Raw JSON response</p>
                  <a href={result.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" data-testid="link-result-source">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="rounded-md border border-border bg-muted/40 overflow-hidden">
                  <div className="border-b border-border px-3 py-2">
                    <span className="text-xs text-muted-foreground font-mono break-all">
                      GET /api/v1/addresses/validate?country={submittedParams?.country}&amp;postcode={encodeURIComponent(submittedParams?.postcode ?? "")}
                      {submittedParams?.city   ? `&city=${encodeURIComponent(submittedParams.city)}`   : ""}
                      {submittedParams?.street ? `&street=${encodeURIComponent(submittedParams.street)}` : ""}
                      {submittedParams?.house_number ? `&house_number=${encodeURIComponent(submittedParams.house_number)}` : ""}
                    </span>
                  </div>
                  <JsonHighlight json={result} />
                </div>
              </div>

              <button
                data-testid="button-view-on-map"
                onClick={() => setLocation("/explore")}
                className="w-full rounded-md border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                View on Coverage Map
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
