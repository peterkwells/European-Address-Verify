import { useState } from "react";
import { useListCoverage } from "@workspace/api-client-react";
import type { CountryCoverage } from "@workspace/api-client-react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

type SortField = "country_name" | "tier" | "cost" | "legal_risk";
type SortDir = "asc" | "desc";

const LEGAL_RISK_ORDER: Record<string, number> = {
  "very-high": 4,
  high: 3,
  medium: 2,
  low: 1,
};

const TIER_COLORS: Record<number, { badge: string; dot: string }> = {
  1: {
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  2: {
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  3: {
    badge: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
    dot: "bg-red-500",
  },
};

const RISK_COLORS: Record<string, string> = {
  low: "text-emerald-700 dark:text-emerald-400",
  medium: "text-amber-700 dark:text-amber-400",
  high: "text-orange-700 dark:text-orange-400",
  "very-high": "text-red-700 dark:text-red-400",
};

const RISK_BADGE: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  "very-high": "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
};

const METHOD_LABELS: Record<string, string> = {
  "open-api": "Live API",
  "bulk-local": "Bulk Local",
  "format+reference": "Format + Ref",
  "format-only": "Format Only",
  restricted: "Restricted",
};

function SortIcon({ field, sort }: { field: SortField; sort: { field: SortField; dir: SortDir } }) {
  if (sort.field !== field) return <ChevronsUpDown className="ml-1 inline h-3.5 w-3.5 opacity-40" />;
  if (sort.dir === "asc") return <ChevronUp className="ml-1 inline h-3.5 w-3.5 text-primary" />;
  return <ChevronDown className="ml-1 inline h-3.5 w-3.5 text-primary" />;
}

function sortCountries(countries: CountryCoverage[], field: SortField, dir: SortDir): CountryCoverage[] {
  return [...countries].sort((a, b) => {
    let cmp = 0;
    if (field === "country_name") {
      cmp = a.country_name.localeCompare(b.country_name);
    } else if (field === "tier") {
      cmp = a.tier - b.tier;
    } else if (field === "cost") {
      cmp = a.cost.localeCompare(b.cost);
    } else if (field === "legal_risk") {
      cmp = (LEGAL_RISK_ORDER[a.legal_risk] ?? 0) - (LEGAL_RISK_ORDER[b.legal_risk] ?? 0);
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

export default function Coverage() {
  const { data, isLoading, error } = useListCoverage();
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({
    field: "legal_risk",
    dir: "desc",
  });

  function handleSort(field: SortField) {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" }
    );
  }

  const sorted = data ? sortCountries(data.countries, sort.field, sort.dir) : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="heading-coverage">
          Country Coverage
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data ? `${data.count} countries supported.` : "Loading..."} Click column headers to sort.
          Default sort shows highest legal risk first.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-3 text-xs">
        {[1, 2, 3].map((tier) => (
          <div key={tier} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${TIER_COLORS[tier]?.dot}`} />
            <span className="text-muted-foreground">
              Tier {tier} — {tier === 1 ? "Live API" : tier === 2 ? "Local Dataset" : "Restricted"}
            </span>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm" data-testid="table-coverage">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-foreground">
                  <button
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                    onClick={() => handleSort("country_name")}
                    data-testid="button-sort-country_name"
                  >
                    Country
                    <SortIcon field="country_name" sort={sort} />
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">
                  <button
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                    onClick={() => handleSort("tier")}
                    data-testid="button-sort-tier"
                  >
                    Tier
                    <SortIcon field="tier" sort={sort} />
                  </button>
                </th>
                <th className="hidden px-4 py-3 text-left font-semibold text-foreground sm:table-cell">
                  Method
                </th>
                <th className="hidden px-4 py-3 text-left font-semibold text-foreground md:table-cell">
                  Data Source
                </th>
                <th className="hidden px-4 py-3 text-left font-semibold text-foreground lg:table-cell">
                  Licence
                </th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">
                  <button
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                    onClick={() => handleSort("cost")}
                    data-testid="button-sort-cost"
                  >
                    Cost
                    <SortIcon field="cost" sort={sort} />
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">
                  <button
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                    onClick={() => handleSort("legal_risk")}
                    data-testid="button-sort-legal_risk"
                  >
                    Legal Risk
                    <SortIcon field="legal_risk" sort={sort} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-muted" style={{ width: `${40 + Math.random() * 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))}

              {error && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Failed to load coverage data.
                  </td>
                </tr>
              )}

              {sorted.map((country) => {
                const tierStyle = TIER_COLORS[country.tier];
                return (
                  <tr
                    key={country.country_code}
                    className="transition-colors hover:bg-muted/40"
                    data-testid={`row-country-${country.country_code}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{country.country_code}</span>
                        <span className="font-medium text-foreground">{country.country_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {tierStyle && (
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${tierStyle.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${tierStyle.dot}`} />
                          {country.tier}
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">
                      {METHOD_LABELS[country.validation_method] ?? country.validation_method}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell max-w-[160px] truncate">
                      {country.data_source}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{country.licence}</code>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {country.cost}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${RISK_BADGE[country.legal_risk] ?? ""}`}
                        data-testid={`badge-risk-${country.country_code}`}
                      >
                        {country.legal_risk.replace("-", " ")}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
