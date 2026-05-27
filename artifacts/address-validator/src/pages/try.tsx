import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useListCoverage,
  useValidateAddress,
  getValidateAddressQueryKey,
} from "@workspace/api-client-react";
import type { ValidateAddressParams } from "@workspace/api-client-react";
import { CheckCircle2, XCircle, HelpCircle, AlertTriangle, Loader2, ExternalLink } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const schema = z.object({
  country: z.string().min(2, "Select a country"),
  postcode: z.string().min(1, "Postcode is required"),
  city: z.string().optional(),
  street: z.string().optional(),
  house_number: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const CONFIDENCE_LABELS: Record<string, { label: string; desc: string }> = {
  high: { label: "High", desc: "Full address matched against authoritative source" },
  medium: { label: "Medium", desc: "Postcode + city matched" },
  low: { label: "Low", desc: "Postcode format only" },
  unknown: { label: "Unknown", desc: "Restricted or unavailable" },
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "text-emerald-700 dark:text-emerald-400",
  medium: "text-amber-700 dark:text-amber-400",
  low: "text-orange-700 dark:text-orange-400",
  unknown: "text-muted-foreground",
};

const METHOD_LABELS: Record<string, string> = {
  "open-api": "Live API",
  "bulk-local": "Bulk Local Dataset",
  "format+reference": "Format + Reference",
  "format-only": "Format Only",
  restricted: "Restricted",
};

function ValidIcon({ valid }: { valid: boolean | null }) {
  if (valid === true)
    return <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
  if (valid === false)
    return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
  return <HelpCircle className="h-5 w-5 text-muted-foreground" />;
}

function ResultRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-xs font-medium text-muted-foreground shrink-0 w-36">{label}</span>
      <span className={`text-xs text-foreground text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

const EXAMPLE_ADDRESSES: { country: string; postcode: string; city?: string; label: string }[] = [
  { country: "FR", postcode: "75001", city: "Paris", label: "Paris, France" },
  { country: "DE", postcode: "10115", city: "Berlin", label: "Berlin, Germany" },
  { country: "NL", postcode: "1012AB", city: "Amsterdam", label: "Amsterdam, NL" },
  { country: "ES", postcode: "28001", city: "Madrid", label: "Madrid, Spain" },
  { country: "GB", postcode: "SW1A 1AA", city: "London", label: "London, UK (restricted)" },
];

export default function Try() {
  const { data: coverageData } = useListCoverage();
  const [params, setParams] = useState<ValidateAddressParams | null>(null);

  const { data: result, isLoading, error, isFetching } = useValidateAddress(
    params ?? undefined,
    {
      query: {
        enabled: !!(params?.country && params?.postcode),
        queryKey: getValidateAddressQueryKey(params ?? undefined),
      },
    }
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { country: "", postcode: "", city: "", street: "", house_number: "" },
  });

  function onSubmit(values: FormValues) {
    const p: ValidateAddressParams = {
      country: values.country,
      postcode: values.postcode,
      ...(values.city ? { city: values.city } : {}),
      ...(values.street ? { street: values.street } : {}),
      ...(values.house_number ? { house_number: values.house_number } : {}),
    };
    setParams(p);
  }

  function loadExample(ex: typeof EXAMPLE_ADDRESSES[number]) {
    form.setValue("country", ex.country);
    form.setValue("postcode", ex.postcode);
    form.setValue("city", ex.city ?? "");
    form.setValue("street", "");
    form.setValue("house_number", "");
    setParams(null);
  }

  const apiError = error as { data?: { message?: string }; status?: number } | null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="heading-try">
          API Explorer
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Validate a European address in real time. Select a country, enter a postcode, and optionally add city or street details.
        </p>
      </div>

      <div className="mb-5">
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Quick examples</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_ADDRESSES.map((ex) => (
            <button
              key={ex.label}
              data-testid={`button-example-${ex.country.toLowerCase()}`}
              onClick={() => loadExample(ex)}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Address Input</h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Country *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-country" className="text-sm">
                          <SelectValue placeholder="Select a country…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {coverageData?.countries.map((c) => (
                          <SelectItem
                            key={c.country_code}
                            value={c.country_code}
                            data-testid={`option-country-${c.country_code}`}
                          >
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

              <FormField
                control={form.control}
                name="postcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Postcode *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        data-testid="input-postcode"
                        placeholder="e.g. 75001"
                        className="font-mono text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">City</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        data-testid="input-city"
                        placeholder="Optional"
                        className="text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="street"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Street</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-street"
                          placeholder="Optional"
                          className="text-sm"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="house_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">House No.</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-house-number"
                          placeholder="Optional"
                          className="text-sm"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                data-testid="button-validate"
                className="w-full"
                disabled={isFetching}
              >
                {isFetching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating…
                  </>
                ) : (
                  "Validate Address"
                )}
              </Button>
            </form>
          </Form>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Result</h2>

          {!params && !result && (
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
            <div data-testid="result-panel">
              <div className="mb-4 flex items-center gap-3">
                <ValidIcon valid={result.valid} />
                <div>
                  <p className="text-sm font-semibold text-foreground" data-testid="result-valid">
                    {result.valid === true
                      ? "Address is valid"
                      : result.valid === false
                      ? "Address is invalid"
                      : "Validity unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Confidence:{" "}
                    <span className={`font-medium ${CONFIDENCE_COLORS[result.confidence]}`}>
                      {CONFIDENCE_LABELS[result.confidence]?.label ?? result.confidence}
                    </span>
                    {" — "}
                    {CONFIDENCE_LABELS[result.confidence]?.desc}
                  </p>
                </div>
              </div>

              <div className="rounded-md border border-border bg-muted/30 px-4">
                <ResultRow label="Method" value={METHOD_LABELS[result.method] ?? result.method} />
                <ResultRow
                  label="Source"
                  value={
                    <a
                      href={result.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                      data-testid="link-source-url"
                    >
                      {result.source}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  }
                />
                <ResultRow label="Licence" value={<code className="text-xs">{result.licence}</code>} mono />

                {result.normalised_address && (
                  <>
                    {result.normalised_address.postcode && (
                      <ResultRow label="Postcode (norm.)" value={result.normalised_address.postcode} mono />
                    )}
                    {result.normalised_address.city && (
                      <ResultRow label="City (norm.)" value={result.normalised_address.city} />
                    )}
                    {result.normalised_address.street && (
                      <ResultRow label="Street (norm.)" value={result.normalised_address.street} />
                    )}
                  </>
                )}
              </div>

              {result.warnings.length > 0 && (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30" data-testid="result-warnings">
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

              <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Raw request</p>
                <code className="block text-xs text-foreground break-all font-mono" data-testid="result-raw-url">
                  {`GET /api/v1/addresses/validate?country=${params?.country}&postcode=${encodeURIComponent(params?.postcode ?? "")}${params?.city ? `&city=${encodeURIComponent(params.city)}` : ""}${params?.street ? `&street=${encodeURIComponent(params.street)}` : ""}${params?.house_number ? `&house_number=${encodeURIComponent(params.house_number)}` : ""}`}
                </code>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
