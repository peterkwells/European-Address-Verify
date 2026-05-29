import { Link } from "wouter";
import { Suspense, lazy, useState } from "react";
import { useGetApiMeta } from "@workspace/api-client-react";
import { ArrowRight, CheckCircle2, AlertTriangle, XCircle, Zap, Database, Globe2, Loader2, Info, X } from "lucide-react";

const CoverageMap = lazy(() =>
  import("@/components/CoverageMap").then((m) => ({ default: m.CoverageMap }))
);

const TIERS = [
  {
    tier: 1,
    label: "Tier 1 — Live API",
    description: "Real-time validation against authoritative government APIs. Full address confidence.",
    color: "bg-green-100 border-green-300 dark:bg-green-950/40 dark:border-green-700",
    badge: "bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100",
    icon: CheckCircle2,
    iconColor: "text-green-700 dark:text-green-400",
    cost: "Free",
    risk: "Low",
  },
  {
    tier: 2,
    label: "Tier 2 — Bulk Dataset",
    description: "Validated against locally stored, openly licensed full address datasets. High confidence including street and house number.",
    color: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    icon: Database,
    iconColor: "text-emerald-600 dark:text-emerald-400",
    cost: "Free",
    risk: "Low",
  },
  {
    tier: 3,
    label: "Tier 3 — Coming Soon",
    description: "Openly licensed data identified but not yet fully loaded. Currently validates postcode and city only via reference data.",
    color: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    icon: AlertTriangle,
    iconColor: "text-amber-600 dark:text-amber-400",
    cost: "Free",
    costLabel: "Expected Cost",
    risk: "Low",
    riskLabel: "Expected Risk",
  },
  {
    tier: 4,
    label: "Tier 4 — Restricted",
    description: "Data is commercially and legally restricted. Validation returns null. Only affects GB (United Kingdom).",
    color: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
    badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    icon: XCircle,
    iconColor: "text-red-600 dark:text-red-400",
    cost: "Requires negotiation",
    risk: "Medium",
  },
];

function StatCard({ label, value, sub }: { label: string; value: number | undefined; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-6 py-5" data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">
        {value ?? <span className="inline-block h-8 w-12 animate-pulse rounded bg-muted" />}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function MapFallback() {
  return (
    <div className="flex h-[480px] items-center justify-center rounded-lg border border-border bg-muted/30">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function Home() {
  const { data: meta } = useGetApiMeta();
  const [betaDismissed, setBetaDismissed] = useState(false);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">

      {/* ── Beta notice ── */}
      {meta?.status === "beta" && meta.notice && !betaDismissed && (
        <div
          className="mb-6 flex items-start justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-800 dark:bg-blue-950/30"
          data-testid="banner-beta-notice"
        >
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <p className="text-blue-800 dark:text-blue-200">{meta.notice}</p>
          </div>
          <button
            aria-label="Dismiss beta notice"
            onClick={() => setBetaDismissed(true)}
            className="shrink-0 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200"
            data-testid="button-dismiss-beta"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Hero ── */}
      <div className="mb-8 max-w-3xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          <Zap className="h-3 w-3 text-primary" />
          <span>20 countries · as zero cost and openly licensed as possible</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl" data-testid="heading-hero">
          European Address Validation
        </h1>
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
          An API for validating full addresses across 20 European countries using authoritative,
          openly licensed data sources published as a public service. Most of Europe is free and low-risk.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/try" data-testid="link-cta-try">
            <span className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
              Try the API
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
          <Link href="/coverage" data-testid="link-cta-coverage">
            <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary">
              View Coverage Table
            </span>
          </Link>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Countries" value={meta?.country_count} sub="across Europe" />
        <StatCard label="Tier 1"    value={meta?.tier_1_count}  sub="live API" />
        <StatCard label="Tier 2"    value={meta?.tier_2_count}  sub="bulk dataset" />
        <StatCard label="Tier 3"    value={meta?.tier_3_count}  sub="coming soon" />
        <StatCard label="Tier 4"    value={meta?.tier_4_count}  sub="restricted" />
      </div>

      {/* ── Coverage Map ── */}
      <div className="mb-12">
        <div className="mb-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Coverage Map</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Click any country to see validation method, cost, legal risk, and to try the API live.
          </p>
        </div>
        <Suspense fallback={<MapFallback />}>
          <CoverageMap />
        </Suspense>
      </div>

      {/* ── Tier cards ── */}
      <div className="mb-10">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Validation Tiers</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Coverage quality varies by country. The vast majority of Europe is free and openly licensed.
        </p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {TIERS.map(({ tier, label, description, color, badge, icon: Icon, iconColor, cost, costLabel, risk, riskLabel }) => (
            <div key={tier} className={`rounded-lg border p-5 ${color}`} data-testid={`card-tier-${tier}`}>
              <div className="mb-3 flex items-start justify-between">
                <Icon className={`h-5 w-5 ${iconColor}`} />
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}>Tier {tier}</span>
              </div>
              <h3 className="mb-1.5 text-sm font-semibold text-foreground">{label}</h3>
              <p className="mb-4 text-xs leading-relaxed text-muted-foreground">{description}</p>
              <div className="flex gap-4 text-xs">
                <div>
                  <span className="font-medium text-muted-foreground">{costLabel ?? "Cost"}: </span>
                  <span className="text-foreground">{cost}</span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">{riskLabel ?? "Risk"}: </span>
                  <span className="text-foreground">{risk}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── GB warning ── */}
      <div className="rounded-lg border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/30 mb-12" data-testid="banner-gb-warning">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">
              United Kingdom (GB) — Medium Risk
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-red-700 dark:text-red-300">
              UK address data is commercially locked by two overlapping monopolies. Royal Mail licenses the Postcode Address File (PAF) — the definitive record of postal addresses — and Ordnance Survey licenses AddressBase, which links property identifiers (UPRNs) to full address attributes. Both are required for a complete address service and both are willing to legally enforce their rights; neither is freely available for anyone to use. This API returns{" "}
              <code className="rounded bg-red-200/60 px-1 font-mono text-xs dark:bg-red-900/60">valid: null</code>{" "}
              for GB addresses. We recommend evaluating licensed PAF and AddressBase providers and checking with a lawyer before building any production address service for the United Kingdom.
            </p>
          </div>
        </div>
      </div>

      {/* ── Quick start ── */}
      <div className="border-t border-border pt-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quick Start</h2>
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Example — Validate a French address</span>
          </div>
          <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-foreground" data-testid="code-quickstart">
            <code>{`GET https://european-address-verify.replit.app/api/v1/addresses/validate?country=FR&postcode=75001&street=Rue+de+Rivoli&house_number=12

{
  "valid": true,
  "confidence": "high",
  "method": "open-api",
  "source": "api-adresse.data.gouv.fr",
  "licence": "ODbL-1.0",
  "normalised_address": {
    "postcode": "75001",
    "city": "Paris",
    "street": "Rue de Rivoli",
    "house_number": "12",
    "country_code": "FR"
  },
  "warnings": []
}`}</code>
          </pre>
        </div>
        {meta && (
          <p className="mt-3 text-xs text-muted-foreground">
            API v{meta.version} &mdash;{" "}
            <a href={meta.documentation_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" data-testid="link-docs">
              Documentation
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
